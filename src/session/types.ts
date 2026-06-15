import type { WorkspaceID } from "../workspace/types"

export type { ModelMessage, StoredMessage } from "../model/message"

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
