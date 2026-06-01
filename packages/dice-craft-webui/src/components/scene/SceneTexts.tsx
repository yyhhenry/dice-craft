import type { SceneText } from "@shared/schemas"

interface SceneTextsProps {
  texts: SceneText[]
}

const STYLE_CLASSES: Record<string, string> = {
  narrative: "italic text-muted-foreground",
  status: "font-mono text-sm text-blue-400",
  alert: "font-bold text-red-400",
  info: "text-sm text-muted-foreground",
}

export function SceneTexts({ texts }: SceneTextsProps) {
  if (texts.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {texts.map((t) => (
        <div key={t.id} className={STYLE_CLASSES[t.style ?? "info"] ?? STYLE_CLASSES.info}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
