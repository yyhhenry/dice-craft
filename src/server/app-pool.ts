import { createApp, type App } from "../app"
import type { WorkspaceManager } from "../workspace/manager"
import type { SessionManager } from "../session/manager"
import type { ChatManager } from "../chat/manager"
import type { WorkspaceID } from "../workspace/types"
import type { ModelConfig } from "../model/openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

export interface AppPoolDeps {
  workspaceManager: WorkspaceManager
  sessionManager: SessionManager
  chatManager: ChatManager
}

export interface AppInstance {
  app: App
  sessionId: string
  workspaceId: WorkspaceID
}

export class AppPool {
  private instances = new Map<string, AppInstance>()
  private deps: AppPoolDeps

  constructor(deps: AppPoolDeps) {
    this.deps = deps
  }

  getOrCreate(
    sessionId: string,
    workspaceId: WorkspaceID,
    callbacks: {
      onMessage?: (sessionId: string) => void
      onStatusChange?: (sessionId: string, primaryActive: boolean, subagentCount: number) => void
    },
  ): AppInstance {
    const existing = this.instances.get(sessionId)
    if (existing) return existing

    const ws = this.deps.workspaceManager.get(workspaceId)
    if (!ws) throw new Error(`Workspace not found: ${workspaceId}`)

    const config = this.deps.workspaceManager.getConfig(workspaceId)
    if (!config) throw new Error(`Workspace not configured: ${workspaceId}`)

    const modelConfig: ModelConfig = {
      baseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      model: config.modelName,
    }

    const app = createApp({
      dataDir: "data",
      workspaceId,
      workspacePath: ws.path,
      skillsDir: ws.skillsDir,
      primarySessionId: sessionId,
      modelConfig,
    })

    // Restore session history
    const messages = this.deps.sessionManager.getMessages(sessionId)
    if (messages.length > 0) {
      const history: ChatCompletionMessageParam[] = messages.map((m) => {
        const { _meta: _, ...rest } = m
        return rest as ChatCompletionMessageParam
      })
      app.primaryAgent.setHistory(history)

      // Restore subagent sessions
      const subagents = this.deps.sessionManager.listSubagents(sessionId)
      for (const sub of subagents) {
        app.dispatcher.restore(sub.id)
      }
    }

    // Wire status callbacks
    app.primaryAgent.onStatusChange = (running) => {
      callbacks.onStatusChange?.(sessionId, running, app.dispatcher.getActiveCount())
    }

    app.dispatcher.onActiveCountChange = (count) => {
      callbacks.onStatusChange?.(sessionId, app.primaryAgent.isRunning(), count)
    }

    // Wire message callback
    app.chatManager.onMessage(() => {
      callbacks.onMessage?.(sessionId)
    })

    const instance: AppInstance = { app, sessionId, workspaceId }
    this.instances.set(sessionId, instance)
    return instance
  }

  get(sessionId: string): AppInstance | undefined {
    return this.instances.get(sessionId)
  }
}
