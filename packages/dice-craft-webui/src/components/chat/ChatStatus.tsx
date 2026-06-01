import { Loader2, Bot } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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

  if (status.primaryActive) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Thinking
        </span>
        {status.npcCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {status.npcCount}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {status.npcCount} NPC{status.npcCount > 1 ? "s" : ""} active
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  if (status.npcCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bot className="h-3 w-3" />
            {status.npcCount}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {status.npcCount} NPC{status.npcCount > 1 ? "s" : ""} active
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="text-xs text-muted-foreground/50">
      Idle
    </div>
  )
}
