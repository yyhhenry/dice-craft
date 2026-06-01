import type { WorkspaceConfig } from "@shared/schemas"
import type { SceneState } from "@shared/schemas"

export interface WorkspaceInfo {
  id: string
  name: string
  ownerId: string
  path: string
  skillsDir: string
  createdAt: string
}

export interface SessionInfo {
  id: string
  workspaceId: string
  parentSessionId?: string
  title: string
  agentType: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

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

const BASE = ""

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, opts)
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  getWorkspaces: () => request<WorkspaceInfo[]>("/api/workspaces"),

  createWorkspace: (name: string) =>
    request<WorkspaceInfo>("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  getWorkspaceConfig: (id: string) =>
    request<WorkspaceConfig>(`/api/workspaces/${id}/config`),

  putWorkspaceConfig: (id: string, config: WorkspaceConfig) =>
    request<WorkspaceConfig>(`/api/workspaces/${id}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }),

  getSessions: (workspaceId: string) =>
    request<SessionInfo[]>(`/api/workspaces/${workspaceId}/sessions`),

  createSession: (workspaceId: string, title?: string) =>
    request<SessionInfo>(`/api/workspaces/${workspaceId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),

  getMessages: (sessionId: string) =>
    request<ChatMessage[]>(`/api/sessions/${sessionId}/messages`),

  getScene: (sessionId: string) =>
    request<SceneState>(`/api/sessions/${sessionId}/scene`),

  deleteSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" }),
}
