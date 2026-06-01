import { useState, useEffect } from "react"
import { api, type ChatMessage } from "@/lib/api"

export function useMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return
    }

    setLoading(true)
    setError(null)
    api
      .getMessages(sessionId)
      .then(setMessages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { messages, loading, error }
}
