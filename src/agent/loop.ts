import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel, type StreamCallbacks } from "../model/openai"
import { ToolRegistry } from "../tool/base"
import { COMPACT_THRESHOLD_RATIO, COMPACT_RECENT_TURNS, type ContextUsage } from "../shared/schemas"

export interface PendingEvent {
  source: string
  content: string
}

export interface AgentConfig {
  maxIterations?: number
  systemPrompt?: string
  contextWindowTokens?: number
  recentTurnsToKeep?: number
  /** Called when model produces text without using any tool. Fallback output. */
  onResponse?: (response: string) => void
  /** Called when running state changes (true = started, false = idle). */
  onStatusChange?: (running: boolean) => void
}

interface CompactState {
  summary: string
  compactedUpTo: number
}

const COMPACT_SYSTEM_PROMPT = `You are a context summarization assistant for a tabletop RPG gaming session.

Summarize the conversation history you are given. The newest turns are kept verbatim outside your summary, so focus on the older context that still matters for continuing the game.

If the prompt includes a <previous-summary> block, treat it as the anchor. Generate a comprehensive updated summary that includes all still-relevant information from the previous summary AND the new context. Do not lose any important details from the previous summary.

Follow the exact output structure requested. Keep every section.
Preserve exact names, IDs, locations, rules, numbers, and game state.
Prefer terse bullets over prose paragraphs.
Do not mention that you are summarizing or compacting.
Respond in the same language as the conversation.`

const COMPACT_USER_TEMPLATE = `{anchor}

Output exactly the Markdown structure shown below. Keep every section, even when empty.

## 当前目标
- [当前游戏/对话的主要目标]

## 游戏规则与约束
- [已建立的规则、限制、偏好设定]

## 世界与场景状态
- [地点、物品、环境、时间线]

## 角色与关系
- [NPC、玩家角色、关系、状态]

## 重要事件与决策
- [已发生的关键事件、做出的重要决策]

## 进行中的事项
- [未完成的任务、悬而未决的问题]

## 关键上下文
- [技术细节、错误信息、需要记住的具体数值]

<context_to_compact>
{context}
</context_to_compact>`

export class TokenEstimator {
  private knownBytes = 0
  private knownCount = 0

  update(messages: ChatCompletionMessageParam[]): number {
    if (messages.length > this.knownCount) {
      const encoder = new TextEncoder()
      for (let i = this.knownCount; i < messages.length; i++) {
        this.knownBytes += encoder.encode(JSON.stringify(messages[i])).length
      }
      this.knownCount = messages.length
    }
    return Math.ceil(this.knownBytes / 4)
  }

  reset(): void {
    this.knownBytes = 0
    this.knownCount = 0
  }

  get tokens(): number {
    return Math.ceil(this.knownBytes / 4)
  }
}

export class AgentLoop {
  private model: OpenAIModel
  private registry: ToolRegistry
  private maxIterations: number
  private systemPrompt: string | undefined
  private contextWindowTokens: number
  private recentTurnsToKeep: number
  private thresholdTokens: number
  private compactState: CompactState | null = null
  private estimator = new TokenEstimator()
  private lastPromptTokens: number | null = null
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
    this.contextWindowTokens = config.contextWindowTokens ?? 0
    this.recentTurnsToKeep = config.recentTurnsToKeep ?? COMPACT_RECENT_TURNS
    this.thresholdTokens = Math.floor(this.contextWindowTokens * COMPACT_THRESHOLD_RATIO)
    this.onResponse = config.onResponse
    this.onStatusChange = config.onStatusChange
  }

  setHistory(history: ChatCompletionMessageParam[]): void {
    this.savedHistory = [...history]
    this.compactState = null
    this.lastPromptTokens = null
    this.estimator.reset()
    this.estimator.update(this.savedHistory)
  }

  getHistory(): ChatCompletionMessageParam[] {
    return [...this.savedHistory]
  }

  getContextUsage(): ContextUsage {
    const tokens = this.lastPromptTokens ?? this.estimator.tokens
    const threshold = this.thresholdTokens > 0 ? this.thresholdTokens : this.contextWindowTokens || tokens + 1
    return {
      tokens,
      thresholdTokens: threshold,
      percent: threshold > 0 ? Math.round((tokens / threshold) * 100) : 0,
      compacted: this.compactState !== null,
      compactedMessageCount: this.compactState?.compactedUpTo ?? 0,
    }
  }

  injectEvent(source: string, content: string): void {
    this.eventQueue.push({ source, content })
  }

  receiveMessage(xmlContent: string): void {
    if (this.running) {
      this.injectEvent("chat", xmlContent)
    } else {
      this.pendingMessage = xmlContent
      this.runLoop()
    }
  }

  waitForIdle(): Promise<void> {
    if (!this.running) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve)
    })
  }

  isRunning(): boolean {
    return this.running
  }

  private shouldCompact(): boolean {
    if (this.thresholdTokens <= 0) return false
    if (this.lastPromptTokens !== null) {
      return this.lastPromptTokens >= this.thresholdTokens
    }
    return this.estimator.tokens >= this.thresholdTokens
  }

  private splitMessages(messages: ChatCompletionMessageParam[]): {
    old: ChatCompletionMessageParam[]
    recent: ChatCompletionMessageParam[]
  } | null {
    let userTurnsSeen = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg && msg.role === "user") {
        userTurnsSeen++
        if (userTurnsSeen === this.recentTurnsToKeep) {
          if (i <= 0) return null
          return { old: messages.slice(0, i), recent: messages.slice(i) }
        }
      }
    }
    return null
  }

  private formatForSummary(messages: ChatCompletionMessageParam[]): string {
    return messages
      .map((msg) => {
        const content = typeof msg.content === "string" ? msg.content : (JSON.stringify(msg.content) ?? "")
        if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
          const calls = msg.tool_calls
            .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
            .map((tc) => `${tc.function.name}(${tc.function.arguments})`)
            .join(", ")
          return `[assistant] tool_calls: ${calls}${content ? `\n${content}` : ""}`
        }
        if (msg.role === "tool") {
          const truncated = content.length > 500 ? content.slice(0, 500) + "..." : content
          const toolMsg = msg as Extract<ChatCompletionMessageParam, { role: "tool" }>
          return `[tool ${toolMsg.tool_call_id}] ${truncated}`
        }
        return `[${msg.role}] ${content}`
      })
      .join("\n\n")
  }

  private async summarize(messages: ChatCompletionMessageParam[], previousSummary?: string): Promise<string> {
    const anchor = previousSummary
      ? [
          "Update the anchored summary below using the conversation context that follows.",
          "Preserve all still-relevant details from the previous summary, remove stale details, and integrate new facts.",
          "",
          "<previous-summary>",
          previousSummary,
          "</previous-summary>",
        ].join("\n")
      : "Create a new summary from the conversation context below."

    const context = this.formatForSummary(messages)
    const userPrompt = COMPACT_USER_TEMPLATE.replace("{anchor}", anchor).replace("{context}", context)

    const result = await this.model.chat([
      { role: "system", content: COMPACT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ])
    return result.content?.trim() || "No context was extracted."
  }

  private async buildModelContext(rawMessages: ChatCompletionMessageParam[]): Promise<ChatCompletionMessageParam[]> {
    if (!this.shouldCompact()) {
      return [...rawMessages]
    }

    const split = this.splitMessages(rawMessages)
    if (!split) {
      return [...rawMessages]
    }

    const oldCount = split.old.length
    if (this.compactState && this.compactState.compactedUpTo >= oldCount) {
      // Already compacted all old messages
    } else {
      try {
        const summary = await this.summarize(split.old, this.compactState?.summary)
        this.compactState = { summary, compactedUpTo: oldCount }
      } catch {
        // Summarization failed — fall back to previous state or no compaction
        if (!this.compactState) {
          return [...rawMessages]
        }
      }
    }

    return [
      {
        role: "system",
        content: [
          "## Compacted conversation context",
          "",
          "The following is an authoritative summary of earlier conversation.",
          "Use it together with the recent raw messages that follow.",
          "",
          this.compactState!.summary,
        ].join("\n"),
      },
      ...split.recent,
    ]
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

  async run(
    userMessage: string,
    history?: ChatCompletionMessageParam[],
    callbacks?: StreamCallbacks,
  ): Promise<{ response: string; history: ChatCompletionMessageParam[] }> {
    const effectiveHistory = history ?? this.savedHistory
    const rawMessages: ChatCompletionMessageParam[] = [...effectiveHistory, { role: "user", content: userMessage }]

    // Update estimator with the new user message
    this.estimator.reset()
    this.estimator.update(rawMessages)

    // Build model context (may compact old messages)
    const messages: ChatCompletionMessageParam[] = []
    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt })
    }
    messages.push(...(await this.buildModelContext(rawMessages)))

    const tools = this.registry.all()
    let iterations = 0

    while (iterations < this.maxIterations) {
      iterations++

      const result = await this.model.chat(messages, tools.length > 0 ? tools : undefined, callbacks)

      // Record usage for compaction trigger
      if (result.usage) {
        this.lastPromptTokens = result.usage.promptTokens
      }

      if (result.content && !result.toolCalls) {
        const assistantMessage: ChatCompletionMessageParam = { role: "assistant", content: result.content }
        messages.push(assistantMessage)
        rawMessages.push(assistantMessage)
        this.estimator.update(rawMessages)
        this.savedHistory = [...rawMessages]
        return { response: result.content, history: this.savedHistory }
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

        this.estimator.update(rawMessages)
        continue
      }

      if (result.content) {
        const assistantMessage: ChatCompletionMessageParam = { role: "assistant", content: result.content }
        messages.push(assistantMessage)
        rawMessages.push(assistantMessage)
        this.estimator.update(rawMessages)
        this.savedHistory = [...rawMessages]
        return { response: result.content, history: this.savedHistory }
      }
    }

    this.savedHistory = [...rawMessages]
    return { response: "Max iterations reached. Please try again.", history: this.savedHistory }
  }
}
