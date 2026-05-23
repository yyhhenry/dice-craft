import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel } from "../model/openai"
import { ToolRegistry, type Tool } from "../tool/base"
import { AgentLoop } from "./loop"
import type { AgentRegistry } from "./agent"

export interface SpawnOptions {
  background?: boolean
  visible?: boolean
}

export interface SubagentResult {
  content: string
  sessionId: string
}

export class SubagentDispatcher {
  private model: OpenAIModel
  private toolRegistry: ToolRegistry
  private agentRegistry: AgentRegistry
  private sessions = new Map<string, ChatCompletionMessageParam[]>()
  private sessionCounter = 0

  constructor(model: OpenAIModel, toolRegistry: ToolRegistry, agentRegistry: AgentRegistry) {
    this.model = model
    this.toolRegistry = toolRegistry
    this.agentRegistry = agentRegistry
  }

  private generateSessionId(): string {
    this.sessionCounter++
    return `subagent-${this.sessionCounter}-${Date.now()}`
  }

  async spawn(agentName: string, prompt: string, options: SpawnOptions = {}): Promise<SubagentResult> {
    const agentInfo = this.agentRegistry.get(agentName)
    if (!agentInfo) {
      throw new Error(`Unknown agent type: ${agentName}`)
    }

    const sessionId = this.generateSessionId()
    const history = this.sessions.get(sessionId) ?? []

    const loop = new AgentLoop(this.model, this.toolRegistry, {
      systemPrompt: agentInfo.systemPrompt,
    })

    if (options.background) {
      // Background mode: return sessionId immediately
      this.sessions.set(sessionId, history)
      // Start execution in background (don't await)
      loop.run(prompt, history).then(({ history: newHistory }) => {
        this.sessions.set(sessionId, newHistory)
      }).catch(() => {
        // Background execution failed, keep empty history
      })
      return { content: "", sessionId }
    }

    // Foreground mode: wait for result
    const { response, history: newHistory } = await loop.run(prompt, history)
    this.sessions.set(sessionId, newHistory)

    return { content: response, sessionId }
  }

  async send(sessionId: string, message: string): Promise<SubagentResult> {
    const history = this.sessions.get(sessionId)
    if (!history) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Find system prompt from history if exists
    const systemMsg = history.find((m) => m.role === "system")
    const historyWithoutSystem = history.filter((m) => m.role !== "system")

    const loop = new AgentLoop(this.model, this.toolRegistry, {
      systemPrompt: systemMsg?.content as string,
    })

    const { response, history: newHistory } = await loop.run(message, historyWithoutSystem)
    this.sessions.set(sessionId, newHistory)

    return { content: response, sessionId }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }
}
