import { useMemo } from "react"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { ChatStatus } from "./ChatStatus"
import { useMessages } from "@/hooks/useMessages"
import { useWebSocket } from "@/hooks/useWebSocket"

interface ChatPanelProps {
  sessionId: string
  workspaceId: string
}

export function ChatPanel({ sessionId, workspaceId }: ChatPanelProps) {
  const { messages: historyMessages, loading } = useMessages(sessionId)
  const { messages: wsMessages, status, connected, send } = useWebSocket(sessionId, workspaceId)

  const allMessages = useMemo(() => {
    const seen = new Set(historyMessages.map((m) => m.id))
    const newMsgs = wsMessages.filter((m) => !seen.has(m.id))
    return [...historyMessages, ...newMsgs]
  }, [historyMessages, wsMessages])

  return (
    <aside className="flex h-full w-96 flex-col border-l bg-background">
      <MessageList messages={allMessages} loading={loading} />
      <ChatInput onSend={send} disabled={!connected}>
        <ChatStatus status={status} connected={connected} />
      </ChatInput>
    </aside>
  )
}
