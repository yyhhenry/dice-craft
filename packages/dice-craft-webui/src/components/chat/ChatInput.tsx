import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ChatInputProps {
  disabled?: boolean
}

export function ChatInput({ disabled }: ChatInputProps) {
  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <Textarea
          placeholder={disabled ? "Message sending not available yet" : "Type a message..."}
          disabled={disabled}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button size="icon" disabled={disabled}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
