import { randomUUID } from "crypto"

export type UserID = string & { __brand: "UserID" }
export type WorkspaceID = string & { __brand: "WorkspaceID" }
export type SessionID = string & { __brand: "SessionID" }

export function generateUserID(): UserID {
  return `user_${randomUUID().slice(0, 8)}` as UserID
}

export function generateWorkspaceID(): WorkspaceID {
  return `ws_${randomUUID().slice(0, 8)}` as WorkspaceID
}

export function generateSessionID(): SessionID {
  return `sess_${Date.now()}_${randomUUID().slice(0, 6)}` as SessionID
}

export function generateMessageID(): string {
  return `msg_${Date.now()}_${randomUUID().slice(0, 6)}`
}

export interface WorkspaceInfo {
  id: WorkspaceID
  name: string
  ownerId: UserID
  path: string
  skillsDir: string
  createdAt: string
}
