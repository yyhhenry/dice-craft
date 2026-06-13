export type SenderRole = "user" | "agent" | "npc" | "system"

export interface VoiceAsset {
  asset: string
  duration: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  senderRole: SenderRole
  content: string
  timestamp: string
  voice?: VoiceAsset
}
