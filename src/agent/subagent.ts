import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel } from "../model/openai"
import { ToolRegistry } from "../tool/base"
import { AgentLoop } from "./loop"
import type { AgentRegistry } from "./registry"
import type { SessionManager } from "../session/manager"
import type { WorkspaceID } from "../workspace/types"
import type { NotifyTarget } from "../tool/notify"

export interface SpawnOptions {
  background?: boolean
  visible?: boolean
}

export interface SubagentResult {
  content: string
  sessionId: string
}

export interface LoopSetupContext {
  sessionId: string
  agentName: string
}

export type LoopSetupFn = (ctx: LoopSetupContext) => ToolRegistry | undefined

export class SubagentDispatcher {
  private model: OpenAIModel
  private toolRegistry: ToolRegistry
  private agentRegistry: AgentRegistry
  private sessionManager: SessionManager
  private workspaceId: WorkspaceID
  private activeLoops = new Map<string, AgentLoop>()
  private setupLoop: LoopSetupFn | undefined

  constructor(
    model: OpenAIModel,
    toolRegistry: ToolRegistry,
    agentRegistry: AgentRegistry,
    sessionManager: SessionManager,
    workspaceId: WorkspaceID,
    setupLoop?: LoopSetupFn,
  ) {
    this.model = model
    this.toolRegistry = toolRegistry
    this.agentRegistry = agentRegistry
    this.sessionManager = sessionManager
    this.workspaceId = workspaceId
    this.setupLoop = setupLoop
  }

  async spawn(
    agentName: string,
    prompt: string,
    options: SpawnOptions = {},
    parentSessionId?: string,
  ): Promise<SubagentResult> {
    const agentInfo = this.agentRegistry.get(agentName)
    if (!agentInfo) {
      throw new Error(`Unknown agent type: ${agentName}`)
    }

    const session = this.sessionManager.create({
      workspaceId: this.workspaceId,
      agentType: agentName,
      systemPrompt: agentInfo.systemPrompt,
      title: prompt.slice(0, 50),
      parentSessionId,
    })

    const ctx = { sessionId: session.id, agentName }
    const customRegistry = this.setupLoop?.(ctx)
    const registry = customRegistry ?? this.toolRegistry

    const loop = new AgentLoop(this.model, registry, {
      systemPrompt: agentInfo.systemPrompt,
    })
    this.activeLoops.set(session.id, loop)

    if (options.background) {
      loop.receiveMessage(prompt)
      return { content: "", sessionId: session.id }
    }

    loop.receiveMessage(prompt)
    await loop.waitForIdle()
    const history = loop.getHistory()
    this.persistHistory(session.id, history)

    return { content: "", sessionId: session.id }
  }

  /** Send a message to a subagent via receiveMessage. */
  send(sessionId: string, content: string, expectReply: boolean): Promise<void> {
    const loop = this.activeLoops.get(sessionId)
    if (!loop) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    loop.receiveMessage(content)

    if (expectReply) {
      return loop.waitForIdle().then(() => {
        this.persistLoopHistory(sessionId, loop)
      })
    }
    // Fire and forget, persist when done
    loop.waitForIdle().then(() => {
      this.persistLoopHistory(sessionId, loop)
    }).catch(() => {})
    return Promise.resolve()
  }

  /** Notify multiple NPCs in parallel. */
  async notifyMultiple(targets: NotifyTarget[], content: string): Promise<void> {
    await Promise.all(
      targets.map((t) => this.send(t.session_id, content, t.expect_reply ?? false)),
    )
  }

  /** Restore an existing session from persisted data into memory */
  restore(sessionId: string): void {
    const session = this.sessionManager.get(sessionId)
    if (!session) return

    const messages = this.sessionManager.getMessages(sessionId)
    const history: ChatCompletionMessageParam[] = messages.map((m) => {
      const { _meta, ...rest } = m
      return rest as ChatCompletionMessageParam
    })

    const ctx = { sessionId, agentName: session.agentType }
    const customRegistry = this.setupLoop?.(ctx)
    const registry = customRegistry ?? this.toolRegistry

    const loop = new AgentLoop(this.model, registry, {
      systemPrompt: session.systemPrompt,
    })
    loop.setHistory(history.slice(1))
    this.activeLoops.set(sessionId, loop)
  }

  hasSession(sessionId: string): boolean {
    return this.activeLoops.has(sessionId)
  }

  listSubagents(parentSessionId: string) {
    return this.sessionManager.listSubagents(parentSessionId)
  }

  getLoop(sessionId: string): AgentLoop | undefined {
    return this.activeLoops.get(sessionId)
  }

  private persistLoopHistory(sessionId: string, loop: AgentLoop): void {
    const history = loop.getHistory()
    this.sessionManager.clearMessages(sessionId)
    for (const msg of history) {
      this.sessionManager.appendMessage(sessionId, msg)
    }
  }

  private persistHistory(sessionId: string, history: ChatCompletionMessageParam[]): void {
    for (const msg of history) {
      this.sessionManager.appendMessage(sessionId, msg)
    }
  }
}
