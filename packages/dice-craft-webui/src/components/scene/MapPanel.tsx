import type { SceneState } from "@shared/schemas"
import { TileMapSvg } from "./TileMapSvg"
import { SceneTexts } from "./SceneTexts"
import { Dice5 } from "lucide-react"

interface MapPanelProps {
  scene: SceneState | null
}

export function MapPanel({ scene }: MapPanelProps) {
  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground/50">
          <Dice5 className="mx-auto mb-3 h-16 w-16" />
          <p className="text-sm font-medium">Game Scene</p>
          <p className="mt-1 text-xs">Start a conversation to begin</p>
        </div>
      </div>
    )
  }

  const hasGrid = (scene.map.width ?? 0) > 0 && (scene.map.height ?? 0) > 0
  const hasTexts = (scene.texts?.length ?? 0) > 0

  if (!hasGrid && !hasTexts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground/50">
          <p className="text-sm font-medium">{scene.title ?? "Scene"}</p>
          <p className="mt-1 text-xs">No map data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {scene.title && (
        <div className="border-b px-3 py-1.5 text-sm font-medium">
          {scene.title}
          {scene.map.title && scene.map.title !== scene.title && (
            <span className="ml-2 text-muted-foreground">— {scene.map.title}</span>
          )}
        </div>
      )}
      {hasTexts && <SceneTexts texts={scene.texts!} />}
      {hasGrid && (
        <div className="min-h-0 flex-1">
          <TileMapSvg map={scene.map} characters={scene.characters} />
        </div>
      )}
    </div>
  )
}
