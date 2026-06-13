import { useEffect, useRef, useState, useCallback } from "react"
import { MessageBubble } from "./MessageBubble"
import type { ChatMessage } from "@/lib/api"

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const [voiceQueue, setVoiceQueue] = useState<string[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Detect new voice messages and queue them for auto-play
  useEffect(() => {
    const newVoiceIds: string[] = []
    for (const msg of messages) {
      if (!seenIdsRef.current.has(msg.id)) {
        seenIdsRef.current.add(msg.id)
        if (msg.voice) {
          newVoiceIds.push(msg.id)
        }
      }
    }
    if (newVoiceIds.length > 0) {
      setVoiceQueue((prev) => [...prev, ...newVoiceIds])
    }
  }, [messages])

  // Start playing next in queue when nothing is playing
  useEffect(() => {
    if (!playingId && voiceQueue.length > 0) {
      const [next, ...rest] = voiceQueue
      setPlayingId(next)
      setVoiceQueue(rest)
    }
  }, [playingId, voiceQueue])

  const handleVoiceEnded = useCallback(() => {
    setPlayingId(null)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading messages...</div>
    )
  }

  if (messages.length === 0) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No messages yet</div>
  }

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            autoPlayVoice={msg.id === playingId}
            onVoiceEnded={msg.id === playingId ? handleVoiceEnded : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
