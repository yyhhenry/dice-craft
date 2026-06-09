import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel } from "../model/openai"
import { ToolRegistry } from "../tool/base"
import { AgentLoop, type AgentConfig } from "./loop"
import type { AgentRegistry } from "./registry"
import type { SessionManager } from "../session/manager"
import type { WorkspaceID } from "../workspace/types"
import type { NotifyTarget } from "../tool/notify"

export interface SpawnOptions {
  background?: boolean
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

interface ActiveEntry {
  loop: AgentLoop
  agentType: string
}

export class SubagentDispatcher {
  private model: OpenAIModel
  private toolRegistry: ToolRegistry
  private agentRegistry: AgentRegistry
  private sessionManager: SessionManager
  private workspaceId: WorkspaceID
  private activeLoops = new Map<string, ActiveEntry>()
  private setupLoop: LoopSetupFn | undefined
  private loopConfig: Pick<AgentConfig, "compactThresholdTokens" | "recentTurnsToKeep">

  onSubagentDone?: (sessionId: string, agentName: string, content: string) => void
  onNpcCountChange?: (count: number) => void

  constructor(
    model: OpenAIModel,
    toolRegistry: ToolRegistry,
    agentRegistry: AgentRegistry,
    sessionManager: SessionManager,
    workspaceId: WorkspaceID,
    loopConfig: Pick<AgentConfig, "compactThresholdTokens" | "recentTurnsToKeep"> = {},
    setupLoop?: LoopSetupFn,
  ) {
    this.model = model
    this.toolRegistry = toolRegistry
    this.agentRegistry = agentRegistry
    this.sessionManager = sessionManager
    this.workspaceId = workspaceId
    this.loopConfig = loopConfig
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
      compactThresholdTokens: this.loopConfig.compactThresholdTokens,
      recentTurnsToKeep: this.loopConfig.recentTurnsToKeep,
    })
    this.activeLoops.set(session.id, { loop, agentType: agentName })

    if (options.background) {
      this.emitNpcCount()
      loop.receiveMessage(prompt)
      loop
        .waitForIdle()
        .then(() => {
          this.persistLoopHistory(session.id, loop)
          const content = this.extractLastAssistantContent(loop.getHistory())
          this.onSubagentDone?.(session.id, agentName, content)
        })
        .catch(() => {})
      return { content: "", sessionId: session.id }
    }

    loop.receiveMessage(prompt)
    await loop.waitForIdle()
    const history = loop.getHistory()
    this.persistHistory(session.id, history)
    this.activeLoops.delete(session.id)

    const content = this.extractLastAssistantContent(history)
    return { content, sessionId: session.id }
  }

  send(sessionId: string, content: string, expectReply: boolean): Promise<void> {
    const entry = this.activeLoops.get(sessionId)
    if (!entry) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    entry.loop.receiveMessage(content)

    if (expectReply) {
      return entry.loop.waitForIdle().then(() => {
        this.persistLoopHistory(sessionId, entry.loop)
      })
    }
    entry.loop
      .waitForIdle()
      .then(() => {
        this.persistLoopHistory(sessionId, entry.loop)
      })
      .catch(() => {})
    return Promise.resolve()
  }

  async notifyMultiple(targets: NotifyTarget[], content: string): Promise<void> {
    await Promise.all(targets.map((t) => this.send(t.session_id, content, t.expect_reply ?? false)))
  }

  dismiss(sessionId: string): void {
    this.activeLoops.delete(sessionId)
    this.sessionManager.update(sessionId, { dismissed: true })
    this.emitNpcCount()
  }

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
      compactThresholdTokens: this.loopConfig.compactThresholdTokens,
      recentTurnsToKeep: this.loopConfig.recentTurnsToKeep,
    })
    loop.setHistory(history)
    this.activeLoops.set(sessionId, { loop, agentType: session.agentType })
    this.emitNpcCount()
  }

  hasSession(sessionId: string): boolean {
    return this.activeLoops.has(sessionId)
  }

  getNpcCount(): number {
    let count = 0
    for (const entry of this.activeLoops.values()) {
      if (entry.agentType === "npc") count++
    }
    return count
  }

  listSubagents(parentSessionId: string) {
    return this.sessionManager.listSubagents(parentSessionId)
  }

  getLoop(sessionId: string): AgentLoop | undefined {
    return this.activeLoops.get(sessionId)?.loop
  }

  private emitNpcCount(): void {
    this.onNpcCountChange?.(this.getNpcCount())
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

  private extractLastAssistantContent(history: ChatCompletionMessageParam[]): string {
    const last = history.filter((m) => m.role === "assistant" && m.content).pop()
    return (last?.content as string) ?? ""
  }
}
