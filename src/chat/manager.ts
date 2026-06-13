import fs from "fs"
import path from "path"
import type { ChatMessage, SenderRole, VoiceAsset } from "./types"

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class ChatManager {
  private baseDir: string
  private messageListeners: Array<(msg: ChatMessage) => void> = []

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  onMessage(listener: (msg: ChatMessage) => void): void {
    this.messageListeners.push(listener)
  }

  sendMessage(
    primarySessionId: string,
    opts: {
      content: string
      senderId: string
      senderName: string
      senderRole: SenderRole
      voice?: VoiceAsset
      id?: string
    },
  ): ChatMessage {
    const msg: ChatMessage = {
      id: opts.id ?? generateId(),
      sessionId: primarySessionId,
      senderId: opts.senderId,
      senderName: opts.senderName,
      senderRole: opts.senderRole,
      content: opts.content,
      timestamp: new Date().toISOString(),
      ...(opts.voice ? { voice: opts.voice } : {}),
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
