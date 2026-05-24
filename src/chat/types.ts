export type SenderRole = "user" | "agent" | "npc" | "system"

export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  senderRole: SenderRole
  content: string
  timestamp: string
}

export interface SenderIdentity {
  id: string
  name: string
  role: SenderRole
  color?: string
}
