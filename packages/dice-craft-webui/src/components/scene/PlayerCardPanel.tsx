import type { ScenePlayerCard } from "@shared/schemas"

interface PlayerCardPanelProps {
  card: ScenePlayerCard
}

export function PlayerCardPanel({ card }: PlayerCardPanelProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-muted-foreground">Player</div>
        <span className="text-sm font-medium">{card.name}</span>
      </div>
      {card.summary && <div className="text-xs text-muted-foreground">{card.summary}</div>}
      {card.stats && card.stats.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {card.stats.map((s) => (
            <span key={s.label} className="text-xs">
              <span className="text-muted-foreground">{s.label}:</span>{" "}
              {s.value}{s.max != null ? `/${s.max}` : ""}
            </span>
          ))}
        </div>
      )}
      {card.resources && card.resources.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {card.resources.map((r) => (
            <span key={r.label} className="text-xs">
              <span className="text-muted-foreground">{r.label}:</span>{" "}
              {r.value}{r.max != null ? `/${r.max}` : ""}
            </span>
          ))}
        </div>
      )}
      {card.conditions && card.conditions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {card.conditions.map((c) => (
            <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}
