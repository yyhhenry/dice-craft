import type { SceneQuest } from "@shared/schemas"
import { CheckCircle2, Circle, XCircle, EyeOff } from "lucide-react"

interface QuestPanelProps {
  quest: SceneQuest
}

const STATUS_ICONS = {
  active: <Circle className="h-3 w-3 text-blue-400" />,
  completed: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  failed: <XCircle className="h-3 w-3 text-red-400" />,
  hidden: <EyeOff className="h-3 w-3 text-muted-foreground" />,
}

export function QuestPanel({ quest }: QuestPanelProps) {
  const visibleObjectives = quest.objectives.filter((o) => o.status !== "hidden")

  return (
    <div className="px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">Quest</div>
      <div className="text-sm font-medium">{quest.title}</div>
      {quest.summary && <div className="text-xs text-muted-foreground">{quest.summary}</div>}
      {visibleObjectives.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {visibleObjectives.map((obj) => (
            <div key={obj.id} className="flex items-center gap-1.5 text-xs">
              {STATUS_ICONS[obj.status]}
              <span className={obj.status === "completed" ? "line-through text-muted-foreground" : ""}>
                {obj.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
