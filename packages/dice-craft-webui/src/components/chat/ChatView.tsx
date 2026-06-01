import { useMemo } from "react"
import { ChatHeader } from "./ChatHeader"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { ChatStatus } from "./ChatStatus"
import { useMessages } from "@/hooks/useMessages"
import { useWebSocket } from "@/hooks/useWebSocket"

interface ChatViewProps {
  sessionId: string
  workspaceId: string
  sessionTitle: string
  onBack: () => void
}

export function ChatView({ sessionId, workspaceId, sessionTitle, onBack }: ChatViewProps) {
  const { messages: historyMessages, loading } = useMessages(sessionId)
  const { messages: wsMessages, status, connected, send } = useWebSocket(sessionId, workspaceId)

  // Merge history (from REST) with WS messages, deduplicating by ID
  const allMessages = useMemo(() => {
    const seen = new Set(historyMessages.map((m) => m.id))
    const newMsgs = wsMessages.filter((m) => !seen.has(m.id))
    return [...historyMessages, ...newMsgs]
  }, [historyMessages, wsMessages])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader title={sessionTitle} onBack={onBack}>
        <ChatStatus status={status} connected={connected} />
      </ChatHeader>
      <MessageList messages={allMessages} loading={loading} />
      <ChatInput onSend={send} disabled={!connected} />
    </div>
  )
}
