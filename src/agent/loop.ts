import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel, type StreamCallbacks } from "../model/openai"
import { ToolRegistry } from "../tool/base"

export interface PendingEvent {
  source: string
  content: string
}

export interface AgentConfig {
  maxIterations?: number
  systemPrompt?: string
  onMessage?: (content: string) => void
}

export class AgentLoop {
  private model: OpenAIModel
  private registry: ToolRegistry
  private maxIterations: number
  private systemPrompt: string | undefined
  private eventQueue: PendingEvent[] = []
  private savedHistory: ChatCompletionMessageParam[] = []
  private running = false
  private pendingMessage: string | null = null
  private onMessage: ((content: string) => void) | undefined
  private idleResolvers: Array<() => void> = []

  constructor(model: OpenAIModel, registry: ToolRegistry, config: AgentConfig = {}) {
    this.model = model
    this.registry = registry
    this.maxIterations = config.maxIterations ?? 20
    this.systemPrompt = config.systemPrompt
    this.onMessage = config.onMessage
  }

  setHistory(history: ChatCompletionMessageParam[]): void {
    this.savedHistory = [...history]
  }

  getHistory(): ChatCompletionMessageParam[] {
    return [...this.savedHistory]
  }

  injectEvent(source: string, content: string): void {
    this.eventQueue.push({ source, content })
  }

  /** Receive a message. If idle, starts a new loop. If busy, injects as event. */
  receiveMessage(xmlContent: string): void {
    if (this.running) {
      this.injectEvent("chat", xmlContent)
    } else {
      this.pendingMessage = xmlContent
      this.runLoop()
    }
  }

  /** Returns a promise that resolves when the current loop finishes. */
  waitForIdle(): Promise<void> {
    if (!this.running) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve)
    })
  }

  isRunning(): boolean {
    return this.running
  }

  private async runLoop(): Promise<void> {
    this.running = true
    while (this.pendingMessage) {
      const msg = this.pendingMessage
      this.pendingMessage = null
      await this.run(msg)
    }
    this.running = false
    for (const resolve of this.idleResolvers) {
      resolve()
    }
    this.idleResolvers = []
  }

  private flushEvents(): ChatCompletionMessageParam[] {
    if (this.eventQueue.length === 0) return []

    const events = this.eventQueue.splice(0)
    return events.map((e) => ({
      role: "user" as const,
      content: `<event source="${e.source}">\n${e.content}\n</event>`,
    }))
  }

  async run(
    userMessage: string,
    history?: ChatCompletionMessageParam[],
    callbacks?: StreamCallbacks,
  ): Promise<{ response: string; history: ChatCompletionMessageParam[] }> {
    const messages: ChatCompletionMessageParam[] = []

    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt })
    }

    const effectiveHistory = history ?? this.savedHistory
    messages.push(...effectiveHistory, { role: "user", content: userMessage })

    const tools = this.registry.all()
    let iterations = 0

    while (iterations < this.maxIterations) {
      iterations++

      const result = await this.model.chat(
        messages,
        tools.length > 0 ? tools : undefined,
        callbacks,
      )

      if (result.content && !result.toolCalls) {
        messages.push({ role: "assistant", content: result.content })
        const outHistory = messages.slice(1)
        this.savedHistory = outHistory
        return { response: result.content, history: outHistory }
      }

      if (result.toolCalls) {
        const assistantMessage: ChatCompletionMessageParam = {
          role: "assistant",
          content: result.content,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
        messages.push(assistantMessage)

        for (const call of result.toolCalls) {
          const tool = this.registry.get(call.name)
          let toolResult: string

          if (tool) {
            try {
              const execResult = await tool.execute(call.arguments)
              toolResult = execResult.content
            } catch (error) {
              toolResult = `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
            }
          } else {
            toolResult = `Unknown tool: ${call.name}`
          }

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          })
        }

        const eventMessages = this.flushEvents()
        messages.push(...eventMessages)

        continue
      }

      if (result.content) {
        messages.push({ role: "assistant", content: result.content })
        const outHistory = messages.slice(1)
        this.savedHistory = outHistory
        return { response: result.content, history: outHistory }
      }
    }

    const outHistory = messages.slice(1)
    this.savedHistory = outHistory
    return { response: "Max iterations reached. Please try again.", history: outHistory }
  }
}
