import fs from "fs"
import path from "path"
import type { ChatMessage, SenderIdentity, SenderRole } from "./types"

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class ChatManager {
  private baseDir: string
  private identities = new Map<string, SenderIdentity>()
  private messageListeners: Array<(msg: ChatMessage) => void> = []

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  registerIdentity(identity: SenderIdentity): void {
    this.identities.set(identity.id, identity)
  }

  getIdentity(id: string): SenderIdentity | undefined {
    return this.identities.get(id)
  }

  onMessage(listener: (msg: ChatMessage) => void): void {
    this.messageListeners.push(listener)
  }

  sendMessage(
    primarySessionId: string,
    opts: {
      content: string
      senderId?: string
      senderName?: string
      senderRole?: SenderRole
    },
  ): ChatMessage {
    const senderId = opts.senderId ?? "agent"
    const identity = this.identities.get(senderId)
    const msg: ChatMessage = {
      id: generateId(),
      sessionId: primarySessionId,
      senderId,
      senderName: opts.senderName ?? identity?.name ?? "agent",
      senderRole: opts.senderRole ?? identity?.role ?? "agent",
      content: opts.content,
      timestamp: new Date().toISOString(),
    }
    this.persist(primarySessionId, msg)
    for (const listener of this.messageListeners) {
      listener(msg)
    }
    return msg
  }

  getMessages(primarySessionId: string): ChatMessage[] {
    const filePath = this.chatPath(primarySessionId)
    if (!fs.existsSync(filePath)) return []
    return fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
  }

  getRecentMessages(primarySessionId: string, count: number): ChatMessage[] {
    const all = this.getMessages(primarySessionId)
    return all.slice(-count)
  }

  private chatPath(sessionId: string): string {
    return path.join(this.baseDir, "sessions", sessionId, "chat.jsonl")
  }

  private persist(sessionId: string, msg: ChatMessage): void {
    const dir = path.dirname(this.chatPath(sessionId))
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(this.chatPath(sessionId), JSON.stringify(msg) + "\n")
  }
}
