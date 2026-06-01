import { useMemo } from "react"
import { MessageSquareText } from "lucide-react"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { ChatStatus } from "./ChatStatus"
import { useMessages } from "@/hooks/useMessages"
import { useWebSocket } from "@/hooks/useWebSocket"

interface ChatPanelProps {
  sessionId: string
  workspaceId: string
  active?: boolean
}

export function ChatPanel({ sessionId, workspaceId, active }: ChatPanelProps) {
  const { messages: historyMessages, loading } = useMessages(sessionId)
  const { messages: wsMessages, status, connected, send } = useWebSocket(sessionId, workspaceId)

  const allMessages = useMemo(() => {
    const seen = new Set(historyMessages.map((m) => m.id))
    const newMsgs = wsMessages.filter((m) => !seen.has(m.id))
    return [...historyMessages, ...newMsgs]
  }, [historyMessages, wsMessages])

  return (
    <div className="relative flex h-full flex-col">
      {active && (
        <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-1.5">
          <MessageSquareText className="h-4 w-4 text-foreground" />
          <span className="text-xs font-medium text-foreground">Chat</span>
        </div>
      )}
      <div className="h-8 shrink-0" />
      <MessageList messages={allMessages} loading={loading} />
      <ChatInput onSend={send} disabled={!connected} active={active}>
        <ChatStatus status={status} connected={connected} />
      </ChatInput>
    </div>
  )
}
