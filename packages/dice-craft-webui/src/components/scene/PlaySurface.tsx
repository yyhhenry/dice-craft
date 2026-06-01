import { useMemo } from "react"
import type { SceneState } from "@shared/schemas"
import { MapPanel } from "./MapPanel"
import { CharacterBadge } from "./CharacterBadge"
import { QuestPanel } from "./QuestPanel"
import { PlayerCardPanel } from "./PlayerCardPanel"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PlaySurfaceProps {
  scene: SceneState | null
}

export function PlaySurface({ scene }: PlaySurfaceProps) {
  const hasContent = scene && scene.version > 0

  const otherCharacters = useMemo(
    () => (hasContent ? scene.characters.filter((c) => !c.hidden && c.role !== "player") : []),
    [hasContent, scene],
  )

  if (!hasContent) {
    return <MapPanel scene={null} />
  }

  const title = scene.title ?? scene.map.title

  return (
    <div className="flex h-full flex-col px-4 pt-10 pb-3">
      {/* Title */}
      {title && (
        <div className="mb-3 flex justify-center">
          <div className="rounded-xl bg-card px-5 py-2 text-base font-semibold shadow-sm">
            {title}
            {scene.map.title && scene.map.title !== scene.title && (
              <span className="ml-2 font-normal text-muted-foreground">— {scene.map.title}</span>
            )}
          </div>
        </div>
      )}

      {/* Map + characters */}
      <div className="flex min-h-0 flex-1 gap-3">
        {otherCharacters.length > 0 && (
          <ScrollArea className="w-44 shrink-0 rounded-2xl bg-card/40 p-2.5">
            <div className="flex flex-col gap-2">
              {otherCharacters.map((ch) => (
                <CharacterBadge key={ch.id} character={ch} />
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl">
          <MapPanel scene={scene} />
        </div>
      </div>

      {/* Bottom panels */}
      {(scene.mainQuest?.title || scene.playerCard) && (
        <div className="mt-3 flex gap-3">
          {scene.mainQuest?.title && (
            <div className="flex-1 rounded-2xl bg-card/40">
              <QuestPanel quest={scene.mainQuest} />
            </div>
          )}
          {scene.playerCard && (
            <div className="flex-1 rounded-2xl bg-card/40">
              <PlayerCardPanel card={scene.playerCard} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
