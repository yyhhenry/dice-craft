import type { WorkspaceID } from "../workspace/types"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

export type StoredMessage = ChatCompletionMessageParam & {
  _meta?: {
    id: string
    timestamp: string
  }
}

export type GameMode = "build" | "play"

export interface SessionInfo {
  id: string
  workspaceId: WorkspaceID
  parentSessionId?: string
  title: string
  agentType: string
  systemPrompt?: string
  dismissed?: boolean
  /** build = create games; play = DM runs active instance */
  gameMode?: GameMode
  /** Instance slug under skills/<skill>/instances/ */
  activeGameSlug?: string
  /** Skill pack name, default dnd */
  activeGameSkill?: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
