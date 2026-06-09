import { Gauge } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ContextUsage as ContextUsageData } from "@shared/schemas"

interface ContextUsageProps {
  usage: ContextUsageData | null
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
  return String(value)
}

export function ContextUsage({ usage }: ContextUsageProps) {
  if (!usage) return null

  const percent = Math.min(100, Math.max(0, usage.percent))
  const tone =
    percent >= 90
      ? "bg-destructive"
      : percent >= 70
        ? "bg-amber-500"
        : usage.compacted
          ? "bg-sky-500"
          : "bg-muted-foreground"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gauge className="h-3 w-3" />
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
          </div>
          <span>{percent}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div>
            Context: {formatTokens(usage.tokens)} / {formatTokens(usage.thresholdTokens)} tokens
          </div>
          {usage.compacted && <div>{usage.compactedMessageCount} messages compacted</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
