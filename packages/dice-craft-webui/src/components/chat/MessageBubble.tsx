import { Wrench, User } from "lucide-react"
import type { ChatMessage } from "@/lib/api"
import { getAvatarText } from "@/lib/utils"
import { VoicePlayer } from "./VoicePlayer"

interface MessageBubbleProps {
  message: ChatMessage
  autoPlayVoice?: boolean
  onVoiceEnded?: () => void
}

export function MessageBubble({ message, autoPlayVoice, onVoiceEnded }: MessageBubbleProps) {
  const { senderRole, senderName, content, voice } = message

  const voiceUrl = voice ? `/api/sessions/${message.sessionId}/voice/${message.id}.wav` : null

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
        <div className="max-w-[70%] min-w-0">
          <div className="mb-1 text-right text-xs text-muted-foreground">{senderName}</div>
          <div className="overflow-hidden rounded-lg bg-primary px-3 py-2 text-sm break-words text-primary-foreground">
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
          <span className="text-xs font-medium">{getAvatarText(senderName)}</span>
        )}
      </div>
      <div className="max-w-[70%] min-w-0">
        <div className="mb-1 text-xs text-muted-foreground">{senderName}</div>
        <div className="overflow-hidden rounded-lg bg-muted px-3 py-2 text-sm break-words">
          {content}
          {voiceUrl && (
            <VoicePlayer url={voiceUrl} duration={voice!.duration} autoPlay={autoPlayVoice} onEnded={onVoiceEnded} />
          )}
        </div>
      </div>
    </div>
  )
}
