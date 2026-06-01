import { Wrench, User } from "lucide-react"
import type { ChatMessage } from "@/lib/api"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { senderRole, senderName, content } = message

  if (senderRole === "system") {
    return (
      <div className="text-center">
        <p className="text-xs text-muted-foreground">{content}</p>
      </div>
    )
  }

  if (senderRole === "user") {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[70%]">
          <div className="mb-1 text-right text-xs text-muted-foreground">
            {senderName}
          </div>
          <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
            {content}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4" />
        </div>
      </div>
    )
  }

  // agent or npc
  return (
    <div className="flex gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        {senderRole === "agent" ? (
          <Wrench className="h-4 w-4" />
        ) : (
          <span className="text-xs font-medium">
            {senderName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="max-w-[70%]">
        <div className="mb-1 text-xs text-muted-foreground">{senderName}</div>
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">{content}</div>
      </div>
    </div>
  )
}
