import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { WorkspaceConfig } from "@shared/schemas"

export function useWorkspaceConfig(workspaceId: string | null) {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) {
      setConfig(null)
      return
    }

    setLoading(true)
    setError(null)
    api
      .getWorkspaceConfig(workspaceId)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false))
  }, [workspaceId])

  const save = useCallback(
    async (newConfig: WorkspaceConfig) => {
      if (!workspaceId) return
      setError(null)
      try {
        const saved = await api.putWorkspaceConfig(workspaceId, newConfig)
        setConfig(saved)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed")
        throw e
      }
    },
    [workspaceId],
  )

  return { config, loading, error, save }
}
