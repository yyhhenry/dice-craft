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

  const connect = useCallback(() => {
    if (!sessionId || !workspaceId) return

    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${location.host}/api/ws/sessions/${sessionId}?workspaceId=${workspaceId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === "message") {
        setMessages((prev) => [...prev, data.payload as ChatMessage])
      } else if (data.type === "status") {
        setStatus(data.payload as AgentStatus)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Auto-reconnect after 2 seconds
      reconnectTimer.current = setTimeout(() => connect(), 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [sessionId, workspaceId])

  useEffect(() => {
    setMessages([])
    setStatus({ primaryActive: false, subagentCount: 0 })
    connect()

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "send_message", payload: { content } }))
    }
  }, [])

  return { messages, status, connected, send }
}
