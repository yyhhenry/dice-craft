import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatMessage } from "@/lib/api"

export interface AgentStatus {
  primaryActive: boolean
  subagentCount: number
}

export function useWebSocket(sessionId: string | null, workspaceId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>({ primaryActive: false, subagentCount: 0 })
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef(sessionId)
  const workspaceIdRef = useRef(workspaceId)

  sessionIdRef.current = sessionId
  workspaceIdRef.current = workspaceId

  useEffect(() => {
    if (!sessionId || !workspaceId) return

    setMessages([])
    setStatus({ primaryActive: false, subagentCount: 0 })
    setConnected(false)

    let cancelled = false

    function connect() {
      if (cancelled) return

      const protocol = location.protocol === "https:" ? "wss:" : "ws:"
      const host = import.meta.env.DEV ? `${location.hostname}:3001` : location.host
      const url = `${protocol}//${host}/api/ws/sessions/${sessionId}?workspaceId=${workspaceId}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === "message") {
            setMessages((prev) => [...prev, data.payload as ChatMessage])
          } else if (data.type === "status") {
            setStatus(data.payload as AgentStatus)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        wsRef.current = null
        reconnectTimer.current = setTimeout(() => connect(), 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [sessionId, workspaceId])

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "send_message", payload: { content } }))
    }
  }, [])

  return { messages, status, connected, send }
}
