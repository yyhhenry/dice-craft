import type { SceneCharacter } from "@shared/schemas"
import { ROLE_COLORS } from "./terrain"

interface CharacterBadgeProps {
  character: SceneCharacter
}

export function CharacterBadge({ character }: CharacterBadgeProps) {
  const color = ROLE_COLORS[character.role] ?? ROLE_COLORS.neutral

  return (
    <div className="rounded-xl bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {character.avatarText}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{character.name}</div>
          {character.status && <div className="text-[10px] text-muted-foreground">{character.status}</div>}
        </div>
      </div>
      {character.summary && (
        <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{character.summary}</div>
      )}
    </div>
  )
}
