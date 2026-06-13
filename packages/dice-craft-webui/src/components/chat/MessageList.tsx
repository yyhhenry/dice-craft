import { useEffect, useRef, useState, useCallback } from "react"
import { MessageBubble } from "./MessageBubble"
import type { ChatMessage } from "@/lib/api"

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
  autoPlayIds?: Set<string>
}

export function MessageList({ messages, loading, autoPlayIds }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const playedIdsRef = useRef<Set<string>>(new Set())
  const [voiceQueue, setVoiceQueue] = useState<string[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Queue new auto-play voice messages
  useEffect(() => {
    if (!autoPlayIds || autoPlayIds.size === 0) return
    const newIds: string[] = []
    for (const id of autoPlayIds) {
      if (!playedIdsRef.current.has(id)) {
        playedIdsRef.current.add(id)
        newIds.push(id)
      }
    }
    if (newIds.length > 0) {
      setVoiceQueue((prev) => [...prev, ...newIds])
    }
  }, [autoPlayIds])

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
