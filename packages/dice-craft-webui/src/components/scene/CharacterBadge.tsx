import type { SceneCharacter } from "@shared/schemas"
import { ROLE_COLORS } from "./terrain"

interface CharacterBadgeProps {
  character: SceneCharacter
}

export function CharacterBadge({ character }: CharacterBadgeProps) {
  const color = ROLE_COLORS[character.role] ?? ROLE_COLORS.neutral

  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {character.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{character.name}</div>
        {character.summary && (
          <div className="truncate text-[10px] text-muted-foreground">{character.summary}</div>
        )}
      </div>
      {character.status && (
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{character.status}</span>
      )}
    </div>
  )
}
