import type { WorkspaceID } from "../workspace/types"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

export type StoredMessage = ChatCompletionMessageParam & {
  _meta?: {
    id: string
    timestamp: string
  }
}

export interface SessionInfo {
  id: string
  workspaceId: WorkspaceID
  parentSessionId?: string
  title: string
  agentType: string
  systemPrompt?: string
  dismissed?: boolean
  createdAt: string
  updatedAt: string
  messageCount: number
}
