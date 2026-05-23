import type { WorkspaceID } from "../workspace/types"
import type { SessionInfo, StoredMessage } from "./types"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { SessionStore } from "./store"
import { generateSessionID, generateMessageID } from "../workspace/types"

export class SessionManager {
  private store: SessionStore

  constructor(store: SessionStore) {
    this.store = store
  }

  create(opts: {
    workspaceId: WorkspaceID
    agentType: string
    systemPrompt?: string
    title?: string
    parentSessionId?: string
  }): SessionInfo {
    const id = generateSessionID()
    const now = new Date().toISOString()

    const info: SessionInfo = {
      id,
      workspaceId: opts.workspaceId,
      parentSessionId: opts.parentSessionId,
      title: opts.title ?? "New conversation",
      agentType: opts.agentType,
      systemPrompt: opts.systemPrompt,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }

    this.store.writeSessionInfo(info)
    return info
  }

  get(id: string): SessionInfo | undefined {
    return this.store.readSessionInfo(id)
  }

  listByWorkspace(workspaceId: WorkspaceID): SessionInfo[] {
    return this.store
      .listWorkspaceSessions(workspaceId)
      .map((id) => this.get(id))
      .filter((s): s is SessionInfo => s !== undefined && !s.parentSessionId)
  }

  getLastSession(workspaceId: WorkspaceID): SessionInfo | undefined {
    const sessions = this.listByWorkspace(workspaceId)
    if (sessions.length === 0) return undefined
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  }

  listSubagents(parentSessionId: string): SessionInfo[] {
    const parent = this.get(parentSessionId)
    if (!parent) return []
    return this.store
      .listWorkspaceSessions(parent.workspaceId)
      .map((id) => this.get(id))
      .filter((s): s is SessionInfo => s !== undefined && s.parentSessionId === parentSessionId)
  }

  appendMessage(sessionId: string, message: ChatCompletionMessageParam): StoredMessage {
    const stored: StoredMessage = {
      ...message,
      _meta: {
        id: generateMessageID(),
        timestamp: new Date().toISOString(),
      },
    }
    this.store.appendMessage(sessionId, stored)

    const info = this.get(sessionId)
    if (info) {
      info.messageCount++
      info.updatedAt = new Date().toISOString()
      this.store.writeSessionInfo(info)
    }

    return stored
  }

  getMessages(sessionId: string): StoredMessage[] {
    return this.store.readMessages(sessionId)
  }

  clearMessages(sessionId: string): void {
    this.store.clearMessages(sessionId)
    const info = this.get(sessionId)
    if (info) {
      info.messageCount = 0
      info.updatedAt = new Date().toISOString()
      this.store.writeSessionInfo(info)
    }
  }

  update(id: string, updates: Partial<Pick<SessionInfo, "title">>): void {
    const info = this.get(id)
    if (!info) return
    Object.assign(info, updates, { updatedAt: new Date().toISOString() })
    this.store.writeSessionInfo(info)
  }

  delete(id: string): void {
    this.store.deleteSession(id)
  }
}
