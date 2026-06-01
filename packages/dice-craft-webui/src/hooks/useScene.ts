import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import type { SceneState } from "@shared/schemas"

export function useScene(sessionId: string | null, wsScene: SceneState | null) {
  const [restScene, setRestScene] = useState<SceneState | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setRestScene(null)
      return
    }
    api
      .getScene(sessionId)
      .then(setRestScene)
      .catch(() => {})
  }, [sessionId])

  return wsScene ?? restScene
}
