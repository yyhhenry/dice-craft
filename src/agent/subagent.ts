import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel } from "../model/openai"
import { ToolRegistry } from "../tool/base"
import { AgentLoop } from "./loop"
import type { AgentRegistry } from "./registry"
import type { SessionManager } from "../session/manager"
import type { WorkspaceID } from "../workspace/types"

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
  private sessionManager: SessionManager
  private workspaceId: WorkspaceID
  private activeLoops = new Map<string, AgentLoop>()

  constructor(
    model: OpenAIModel,
    toolRegistry: ToolRegistry,
    agentRegistry: AgentRegistry,
    sessionManager: SessionManager,
    workspaceId: WorkspaceID
  ) {
    this.model = model
    this.toolRegistry = toolRegistry
    this.agentRegistry = agentRegistry
    this.sessionManager = sessionManager
    this.workspaceId = workspaceId
  }

  async spawn(
    agentName: string,
    prompt: string,
    options: SpawnOptions = {},
    parentSessionId?: string
  ): Promise<SubagentResult> {
    const agentInfo = this.agentRegistry.get(agentName)
    if (!agentInfo) {
      throw new Error(`Unknown agent type: ${agentName}`)
    }

    // Create persisted session
    const session = this.sessionManager.create({
      workspaceId: this.workspaceId,
      agentType: agentName,
      systemPrompt: agentInfo.systemPrompt,
      title: prompt.slice(0, 50),
      parentSessionId,
    })

    const loop = new AgentLoop(this.model, this.toolRegistry, {
      systemPrompt: agentInfo.systemPrompt,
    })
    this.activeLoops.set(session.id, loop)

    if (options.background) {
      // Background mode: return sessionId immediately
      loop.run(prompt).then(({ history }) => {
        this.persistHistory(session.id, history)
      }).catch(() => {
        // Background execution failed
      })
      return { content: "", sessionId: session.id }
    }

    // Foreground mode: wait for result
    const { response, history } = await loop.run(prompt)
    this.persistHistory(session.id, history)

    return { content: response, sessionId: session.id }
  }

  async send(sessionId: string, message: string): Promise<SubagentResult> {
    const loop = this.activeLoops.get(sessionId)
    if (!loop) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const { response, history } = await loop.run(message)
    this.overwriteHistory(sessionId, history)

    return { content: response, sessionId }
  }

  /** Restore an existing session from persisted data into memory */
  restore(sessionId: string): void {
    const session = this.sessionManager.get(sessionId)
    if (!session) return

    const messages = this.sessionManager.getMessages(sessionId)
    // Convert StoredMessage back to ChatCompletionMessageParam (strip _meta)
    const history: ChatCompletionMessageParam[] = messages.map((m) => {
      const { _meta, ...rest } = m
      return rest as ChatCompletionMessageParam
    })

    const loop = new AgentLoop(this.model, this.toolRegistry, {
      systemPrompt: session.systemPrompt,
    })
    // Skip the first user message (prompt), rest is history
    loop.setHistory(history.slice(1))
    this.activeLoops.set(sessionId, loop)
  }

  hasSession(sessionId: string): boolean {
    return this.activeLoops.has(sessionId)
  }

  /** List subagent sessions for a parent session */
  listSubagents(parentSessionId: string) {
    return this.sessionManager.listSubagents(parentSessionId)
  }

  private persistHistory(sessionId: string, history: ChatCompletionMessageParam[]): void {
    for (const msg of history) {
      this.sessionManager.appendMessage(sessionId, msg)
    }
  }

  private overwriteHistory(sessionId: string, history: ChatCompletionMessageParam[]): void {
    this.sessionManager.clearMessages(sessionId)
    for (const msg of history) {
      this.sessionManager.appendMessage(sessionId, msg)
    }
  }
}
