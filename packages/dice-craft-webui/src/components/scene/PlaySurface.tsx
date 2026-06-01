import { useMemo } from "react"
import type { SceneState } from "@shared/schemas"
import { DMPanel } from "./DMPanel"
import { MapPanel } from "./MapPanel"
import { CharacterBadge } from "./CharacterBadge"
import { QuestPanel } from "./QuestPanel"
import { PlayerCardPanel } from "./PlayerCardPanel"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PlaySurfaceProps {
  scene: SceneState | null
}

export function PlaySurface({ scene }: PlaySurfaceProps) {
  if (!scene) {
    return <MapPanel scene={null} />
  }

  const otherCharacters = useMemo(
    () => scene.characters.filter((c) => c.visible && c.role !== "player"),
    [scene.characters],
  )

  return (
    <div className="flex h-full flex-col">
      <DMPanel dm={scene.dm} />

      <div className="flex min-h-0 flex-1">
        {/* Characters sidebar */}
        {otherCharacters.length > 0 && (
          <ScrollArea className="w-44 shrink-0 border-r p-2">
            <div className="flex flex-col gap-1.5">
              {otherCharacters.map((ch) => (
                <CharacterBadge key={ch.id} character={ch} />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Map area */}
        <div className="min-w-0 flex-1">
          <MapPanel scene={scene} />
        </div>
      </div>

      {/* Bottom panels */}
      {(scene.mainQuest || scene.playerCard) && (
        <div className="flex shrink-0">
          {scene.mainQuest && (
            <div className="flex-1">
              <QuestPanel quest={scene.mainQuest} />
            </div>
          )}
          {scene.playerCard && (
            <div className="flex-1 border-l">
              <PlayerCardPanel card={scene.playerCard} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
