import type { SceneDM } from "@shared/schemas"
import { Loader2 } from "lucide-react"

interface DMPanelProps {
  dm: SceneDM
}

export function DMPanel({ dm }: DMPanelProps) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{dm.name}</span>
        {dm.status === "thinking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {dm.status === "speaking" && <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />}
      </div>
      {dm.latestSummary && (
        <span className="truncate text-xs text-muted-foreground">{dm.latestSummary}</span>
      )}
    </div>
  )
}
