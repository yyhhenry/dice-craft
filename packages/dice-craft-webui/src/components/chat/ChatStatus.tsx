import { Loader2, Bot } from "lucide-react"
import type { AgentStatus } from "@/hooks/useWebSocket"

interface ChatStatusProps {
  status: AgentStatus
  connected: boolean
}

export function ChatStatus({ status, connected }: ChatStatusProps) {
  if (!connected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        Disconnected
      </div>
    )
  }

  if (!status.primaryActive && status.subagentCount === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {status.primaryActive && (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Thinking
        </span>
      )}
      {status.subagentCount > 0 && (
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3" />
          {status.subagentCount} agent{status.subagentCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}
