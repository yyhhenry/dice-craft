import { useState, useEffect, useCallback } from "react"
import { api, type SessionInfo } from "@/lib/api"

export function useSessions(workspaceId: string | null) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!workspaceId) {
      setSessions([])
      return
    }
    setLoading(true)
    setError(null)
    api
      .getSessions(workspaceId)
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (title?: string) => {
      if (!workspaceId) return null
      const session = await api.createSession(workspaceId, title)
      setSessions((prev) => [...prev, session])
      return session
    },
    [workspaceId]
  )

  return { sessions, loading, error, refresh, create }
}
