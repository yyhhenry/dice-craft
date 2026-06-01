import { ChatHeader } from "./ChatHeader"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { useMessages } from "@/hooks/useMessages"

interface ChatViewProps {
  sessionId: string
  sessionTitle: string
  onBack: () => void
}

export function ChatView({ sessionId, sessionTitle, onBack }: ChatViewProps) {
  const { messages, loading } = useMessages(sessionId)

  return (
    <div className="flex h-full flex-col">
      <ChatHeader title={sessionTitle} onBack={onBack} />
      <MessageList messages={messages} loading={loading} />
      <ChatInput disabled />
    </div>
  )
}
