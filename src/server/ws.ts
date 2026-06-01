import type { ServerWebSocket } from "bun"
import type { AppPool } from "./app-pool"
import type { SessionManager } from "../session/manager"
import type { ChatManager } from "../chat/manager"
import type { WorkspaceID } from "../workspace/types"

export interface WsData {
  sessionId: string
  workspaceId: WorkspaceID
}

export class WsManager {
  private connections = new Map<string, Set<ServerWebSocket<WsData>>>()
  private appPool: AppPool
  private sessionManager: SessionManager
  private chatManager: ChatManager

  constructor(appPool: AppPool, sessionManager: SessionManager, chatManager: ChatManager) {
    this.appPool = appPool
    this.sessionManager = sessionManager
    this.chatManager = chatManager
  }

  open(ws: ServerWebSocket<WsData>): void {
    const { sessionId } = ws.data
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set())
    }
    this.connections.get(sessionId)!.add(ws)

    // Ensure App exists for this session
    const instance = this.appPool.get(sessionId)
    if (instance) {
      // Send current status
      this.sendStatus(sessionId, instance.app.primaryAgent.isRunning(), instance.app.dispatcher.getActiveCount())
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
    // Get or create app
    const instance = this.appPool.getOrCreate(sessionId, workspaceId, {
      onMessage: (sid) => this.broadcastLatestMessage(sid),
      onStatusChange: (sid, primaryActive, subagentCount) => this.sendStatus(sid, primaryActive, subagentCount),
    })

    const { app } = instance

    // Write user message to chat
    app.chatManager.sendMessage(sessionId, {
      content,
      senderId: "user",
      senderName: "Player",
      senderRole: "user",
    })

    // Send to primary agent (non-blocking)
    const chatXml = `<chat sender="user" sender_name="Player">${content}</chat>`
    app.primaryAgent.receiveMessage(chatXml)

    // Persist history when agent finishes
    app.primaryAgent.waitForIdle().then(() => {
      const history = app.primaryAgent.getHistory()
      this.sessionManager.clearMessages(sessionId)
      for (const msg of history) {
        this.sessionManager.appendMessage(sessionId, msg)
      }
    }).catch(() => {})
  }

  private broadcastLatestMessage(sessionId: string): void {
    const messages = this.chatManager.getRecentMessages(sessionId, 1)
    const msg = messages[0]
    if (!msg) return
    this.broadcast(sessionId, JSON.stringify({ type: "message", payload: msg }))
  }

  private sendStatus(sessionId: string, primaryActive: boolean, subagentCount: number): void {
    this.broadcast(sessionId, JSON.stringify({
      type: "status",
      payload: { primaryActive, subagentCount },
    }))
  }

  private broadcast(sessionId: string, data: string): void {
    const conns = this.connections.get(sessionId)
    if (!conns) return
    for (const ws of conns) {
      ws.send(data)
    }
  }
}
