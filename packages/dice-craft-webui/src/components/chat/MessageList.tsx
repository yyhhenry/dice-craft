import { useEffect, useRef } from "react"
import { MessageBubble } from "./MessageBubble"
import type { ChatMessage } from "@/lib/api"

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading messages...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No messages yet
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
