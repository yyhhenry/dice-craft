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
  /** Approximate token budget for model context before compacting old history. */
  compactThresholdTokens?: number
  /** Number of recent user turns to keep as raw messages after compaction. */
  recentTurnsToKeep?: number
  /** Called when model produces text without using any tool. Fallback output. */
  onResponse?: (response: string) => void
  /** Called when running state changes (true = started, false = idle). */
  onStatusChange?: (running: boolean) => void
}

interface CompactState {
  summary: string
  compactedMessageCount: number
}

interface ContextSplit {
  oldMessages: ChatCompletionMessageParam[]
  recentMessages: ChatCompletionMessageParam[]
}

export class AgentLoop {
  private model: OpenAIModel
  private registry: ToolRegistry
  private maxIterations: number
  private systemPrompt: string | undefined
  private compactThresholdTokens: number
  private recentTurnsToKeep: number
  private compactState: CompactState | null = null
  private eventQueue: PendingEvent[] = []
  private savedHistory: ChatCompletionMessageParam[] = []
  private running = false
  private pendingMessage: string | null = null
  private onResponse: ((response: string) => void) | undefined
  onStatusChange: ((running: boolean) => void) | undefined
  private idleResolvers: Array<() => void> = []

  constructor(model: OpenAIModel, registry: ToolRegistry, config: AgentConfig = {}) {
    this.model = model
    this.registry = registry
    this.maxIterations = config.maxIterations ?? 20
    this.systemPrompt = config.systemPrompt
    this.compactThresholdTokens = config.compactThresholdTokens ?? 12000
    this.recentTurnsToKeep = config.recentTurnsToKeep ?? 6
    this.onResponse = config.onResponse
    this.onStatusChange = config.onStatusChange
  }

  setHistory(history: ChatCompletionMessageParam[]): void {
    this.savedHistory = [...history]
    this.compactState = null
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
    this.onStatusChange?.(true)
    try {
      while (this.pendingMessage) {
        const msg = this.pendingMessage
        this.pendingMessage = null
        const { response } = await this.run(msg)
        if (response && this.onResponse) {
          this.onResponse(response)
        }
      }
    } finally {
      this.running = false
      this.onStatusChange?.(false)
      for (const resolve of this.idleResolvers) {
        resolve()
      }
      this.idleResolvers = []
    }
  }

  private flushEvents(): ChatCompletionMessageParam[] {
    if (this.eventQueue.length === 0) return []

    const events = this.eventQueue.splice(0)
    return events.map((e) => ({
      role: "user" as const,
      content: `<event source="${e.source}">\n${e.content}\n</event>`,
    }))
  }

  private estimateTokens(messages: ChatCompletionMessageParam[]): number {
    const chars = messages.reduce((sum, msg) => sum + JSON.stringify(msg).length, 0)
    return Math.ceil(chars / 4)
  }

  private recentStartIndex(messages: ChatCompletionMessageParam[]): number {
    if (this.recentTurnsToKeep <= 0) return messages.length

    let seenUserTurns = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message?.role === "user") {
        seenUserTurns++
        if (seenUserTurns === this.recentTurnsToKeep) {
          return i
        }
      }
    }
    return 0
  }

  private messageContentToText(content: ChatCompletionMessageParam["content"]): string {
    if (typeof content === "string") return content
    if (!content) return ""
    return JSON.stringify(content)
  }

  private formatForSummary(messages: ChatCompletionMessageParam[]): string {
    return messages
      .map((msg, index) => {
        const content = this.messageContentToText(msg.content)
        if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
          return `${index + 1}. assistant tool_calls=${JSON.stringify(msg.tool_calls)} content=${content}`
        }
        if (msg.role === "tool") {
          return `${index + 1}. tool(${msg.tool_call_id}): ${content}`
        }
        return `${index + 1}. ${msg.role}: ${content}`
      })
      .join("\n")
  }

  private splitContext(messages: ChatCompletionMessageParam[]): ContextSplit | undefined {
    if (this.estimateTokens(messages) <= this.compactThresholdTokens) {
      return undefined
    }

    const recentStart = this.recentStartIndex(messages)
    if (recentStart <= 0) {
      return undefined
    }

    return {
      oldMessages: messages.slice(0, recentStart),
      recentMessages: messages.slice(recentStart),
    }
  }

  private async summarizeOldMessages(
    messages: ChatCompletionMessageParam[],
    previousSummary?: string,
  ): Promise<string> {
    const summaryInstruction = previousSummary
      ? [
          "Update the existing structured summary using the additional older conversation context.",
          "Preserve still-true details, remove stale details, and merge in new facts.",
          "",
          "<previous_summary>",
          previousSummary,
          "</previous_summary>",
        ].join("\n")
      : "Create a new structured summary from the older conversation context."

    const prompt = [
      summaryInstruction,
      "Return a structured Markdown summary with these sections:",
      "- Current Objective",
      "- Important Facts and Decisions",
      "- World/Game State",
      "- Characters and Relationships",
      "- Open Threads and Pending Tasks",
      "- Tool Results Worth Preserving",
      "",
      "Preserve concrete names, IDs, locations, rules, constraints, secrets, unresolved questions, and user preferences.",
      "Do not invent details. Keep it concise but sufficient for continuing the conversation.",
      "",
      "<context_to_compact>",
      this.formatForSummary(messages),
      "</context_to_compact>",
    ].join("\n")

    const result = await this.model.chat([{ role: "user", content: prompt }])
    return result.content?.trim() || "No durable context was extracted from older messages."
  }

  private async buildModelContext(rawMessages: ChatCompletionMessageParam[]): Promise<ChatCompletionMessageParam[]> {
    const split = this.splitContext(rawMessages)
    if (!split) {
      return [...rawMessages]
    }

    const oldCount = split.oldMessages.length
    if (!this.compactState) {
      const summary = await this.summarizeOldMessages(split.oldMessages)
      this.compactState = {
        summary,
        compactedMessageCount: oldCount,
      }
    } else if (this.compactState.compactedMessageCount < oldCount) {
      const messagesToMerge = split.oldMessages.slice(this.compactState.compactedMessageCount)
      const summary = await this.summarizeOldMessages(messagesToMerge, this.compactState.summary)
      this.compactState = {
        summary,
        compactedMessageCount: oldCount,
      }
    }

    return [
      {
        role: "system",
        content: [
          "Compact summary of earlier conversation context.",
          "Use this as authoritative background together with the recent raw messages that follow.",
          "",
          this.compactState.summary,
        ].join("\n"),
      },
      ...split.recentMessages,
    ]
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
    const rawMessages: ChatCompletionMessageParam[] = [...effectiveHistory, { role: "user", content: userMessage }]
    messages.push(...(await this.buildModelContext(rawMessages)))

    const tools = this.registry.all()
    let iterations = 0

    while (iterations < this.maxIterations) {
      iterations++

      const result = await this.model.chat(messages, tools.length > 0 ? tools : undefined, callbacks)

      if (result.content && !result.toolCalls) {
        const assistantMessage: ChatCompletionMessageParam = { role: "assistant", content: result.content }
        messages.push(assistantMessage)
        rawMessages.push(assistantMessage)
        const outHistory = [...rawMessages]
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
        rawMessages.push(assistantMessage)

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

          const toolMessage: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          }
          messages.push(toolMessage)
          rawMessages.push(toolMessage)
        }

        const eventMessages = this.flushEvents()
        messages.push(...eventMessages)
        rawMessages.push(...eventMessages)

        continue
      }

      if (result.content) {
        const assistantMessage: ChatCompletionMessageParam = { role: "assistant", content: result.content }
        messages.push(assistantMessage)
        rawMessages.push(assistantMessage)
        const outHistory = [...rawMessages]
        this.savedHistory = outHistory
        return { response: result.content, history: outHistory }
      }
    }

    const outHistory = [...rawMessages]
    this.savedHistory = outHistory
    return { response: "Max iterations reached. Please try again.", history: outHistory }
  }
}
