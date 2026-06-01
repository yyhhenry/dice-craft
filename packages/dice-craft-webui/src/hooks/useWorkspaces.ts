import { useState, useEffect, useCallback } from "react"
import { api, type WorkspaceInfo } from "@/lib/api"

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    api
      .getWorkspaces()
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (name: string) => {
      const ws = await api.createWorkspace(name)
      setWorkspaces((prev) => [...prev, ws])
      return ws
    },
    []
  )

  return { workspaces, loading, error, refresh, create }
}
