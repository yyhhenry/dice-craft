import type { ServerWebSocket } from "bun"
import type { App } from "../app"
import type { AppPool } from "./app-pool"
import type { SessionManager } from "../session/manager"
import type { WorkspaceManager } from "../workspace/manager"
import type { ChatMessage } from "../chat/types"
import type { WorkspaceID } from "../workspace/types"
import type { SceneState } from "../shared/schemas"
import { parseUserCommand } from "../game/commands"
import { instanceExists } from "../game/instance"

export interface WsData {
  sessionId: string
  workspaceId: WorkspaceID
}

export class WsManager {
  private connections = new Map<string, Set<ServerWebSocket<WsData>>>()
  private appPool: AppPool
  private sessionManager: SessionManager
  private workspaceManager: WorkspaceManager

  constructor(appPool: AppPool, sessionManager: SessionManager, workspaceManager: WorkspaceManager) {
    this.appPool = appPool
    this.sessionManager = sessionManager
    this.workspaceManager = workspaceManager
  }

  open(ws: ServerWebSocket<WsData>): void {
    const { sessionId } = ws.data
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set())
    }
    this.connections.get(sessionId)!.add(ws)

    const instance = this.appPool.get(sessionId)
    if (instance) {
      this.sendStatus(sessionId, instance.app.primaryAgent.isRunning(), instance.app.dispatcher.getNpcCount())
    }
  }

  message(ws: ServerWebSocket<WsData>, raw: string | Buffer): void {
    const { sessionId, workspaceId } = ws.data
    let parsed: { type: string; payload?: { content?: string } }
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString())
    } catch {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid JSON" } }))
      return
    }

    if (parsed.type === "send_message") {
      const content = parsed.payload?.content
      if (!content || content.trim().length === 0) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Empty message" } }))
        return
      }
      this.handleSendMessage(sessionId, workspaceId, content.trim())
    }
  }

  close(ws: ServerWebSocket<WsData>): void {
    const { sessionId } = ws.data
    const conns = this.connections.get(sessionId)
    if (conns) {
      conns.delete(ws)
      if (conns.size === 0) {
        this.connections.delete(sessionId)
      }
    }
  }

  private handleSendMessage(sessionId: string, workspaceId: WorkspaceID, content: string): void {
    const command = parseUserCommand(content)
    const session = this.sessionManager.get(sessionId)
    const skill = session?.activeGameSkill ?? "dnd"

    if (command.kind === "play") {
      const slug = command.slug ?? session?.activeGameSlug
      if (!slug) {
        this.systemChat(sessionId, workspaceId, "Usage: /play <slug> — e.g. /play ring_adventure")
        return
      }

      const wsInfo = this.workspaceManager.get(workspaceId)
      if (!wsInfo || !instanceExists(wsInfo.path, skill, slug)) {
        this.systemChat(
          sessionId,
          workspaceId,
          `Game instance not found: skills/${skill}/instances/${slug}/. Build it first.`,
        )
        return
      }

      this.sessionManager.update(sessionId, {
        gameMode: "play",
        activeGameSlug: slug,
        activeGameSkill: skill,
      })
      this.appPool.reset(sessionId)
      this.sessionManager.clearMessages(sessionId)

      const app = this.getOrCreateApp(sessionId, workspaceId)
      if (!app) return

      app.chatManager.sendMessage(sessionId, {
        content,
        senderId: "user",
        senderName: "Player",
        senderRole: "user",
      })
      app.chatManager.sendMessage(sessionId, {
        content: `Entering play mode — skills/${skill}/instances/${slug}/`,
        senderId: "system",
        senderName: "System",
        senderRole: "system",
      })

      this.runAgent(
        app,
        sessionId,
        workspaceId,
        `<event source="system">Play mode started. Instance: skills/${skill}/instances/${slug}/. Load dnd-runtime skill, read instance files, init state, set up scene, welcome the player. Use the same language as the player for all player-facing text.</event>`,
      )
      return
    }

    if (command.kind === "build") {
      this.sessionManager.update(sessionId, {
        gameMode: "build",
        activeGameSlug: undefined,
        activeGameSkill: undefined,
      })
      this.appPool.reset(sessionId)
      this.sessionManager.clearMessages(sessionId)

      const app = this.getOrCreateApp(sessionId, workspaceId)
      if (!app) return

      app.chatManager.sendMessage(sessionId, {
        content,
        senderId: "user",
        senderName: "Player",
        senderRole: "user",
      })
      app.chatManager.sendMessage(sessionId, {
        content: "Switched to build mode. Describe the game you want to create.",
        senderId: "system",
        senderName: "System",
        senderRole: "system",
      })

      this.runAgent(
        app,
        sessionId,
        workspaceId,
        `<event source="system">Build mode activated. Help the player create a new game.</event>`,
      )
      return
    }

    const app = this.getOrCreateApp(sessionId, workspaceId)
    if (!app) return

    if (session && session.title === "New conversation") {
      this.sessionManager.update(sessionId, { title: content.slice(0, 50) })
    }

    app.chatManager.sendMessage(sessionId, {
      content,
      senderId: "user",
      senderName: "Player",
      senderRole: "user",
    })

    const chatXml = `<chat sender="user" sender_name="Player">${content}</chat>`
    this.runAgent(app, sessionId, workspaceId, chatXml)
  }

  private getOrCreateApp(sessionId: string, workspaceId: WorkspaceID): App | null {
    try {
      return this.appPool.getOrCreate(sessionId, workspaceId, {
        onMessage: (sid, msg) => this.broadcastMessage(sid, msg),
        onStatusChange: (sid, primaryActive, npcCount) => this.sendStatus(sid, primaryActive, npcCount),
        onSceneUpdate: (sid, state) => this.broadcastScene(sid, state),
      }).app
    } catch (err) {
      this.broadcast(
        sessionId,
        JSON.stringify({
          type: "error",
          payload: { message: err instanceof Error ? err.message : "Failed to initialize" },
        }),
      )
      return null
    }
  }

  private systemChat(sessionId: string, workspaceId: WorkspaceID, content: string): void {
    const app = this.appPool.get(sessionId)?.app ?? this.getOrCreateApp(sessionId, workspaceId)
    if (app) {
      app.chatManager.sendMessage(sessionId, {
        content,
        senderId: "system",
        senderName: "System",
        senderRole: "system",
      })
      return
    }

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      senderId: "system",
      senderName: "System",
      senderRole: "system",
      content,
      timestamp: new Date().toISOString(),
    }
    this.broadcastMessage(sessionId, msg)
  }

  private runAgent(app: App, sessionId: string, workspaceId: WorkspaceID, agentMessage: string): void {
    app.primaryAgent.receiveMessage(agentMessage)

    app.primaryAgent
      .waitForIdle()
      .then(() => {
        const history = app.primaryAgent.getHistory()
        this.sessionManager.clearMessages(sessionId)
        for (const msg of history) {
          this.sessionManager.appendMessage(sessionId, msg)
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        this.systemChat(sessionId, workspaceId, `Agent failed: ${message}`)
      })
  }

  private broadcastMessage(sessionId: string, msg: ChatMessage): void {
    this.broadcast(sessionId, JSON.stringify({ type: "message", payload: msg }))
  }

  broadcastScene(sessionId: string, state: SceneState): void {
    this.broadcast(sessionId, JSON.stringify({ type: "scene.updated", payload: state }))
  }

  private sendStatus(sessionId: string, primaryActive: boolean, npcCount: number): void {
    this.broadcast(
      sessionId,
      JSON.stringify({
        type: "status",
        payload: { primaryActive, npcCount },
      }),
    )
  }

  private broadcast(sessionId: string, data: string): void {
    const conns = this.connections.get(sessionId)
    if (!conns) return
    for (const ws of conns) {
      ws.send(data)
    }
  }
}
