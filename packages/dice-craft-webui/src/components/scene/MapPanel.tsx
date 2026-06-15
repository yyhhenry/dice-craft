import { useState, useCallback } from "react"
import type { SceneState, SceneOverlay } from "@shared/schemas"
import { TileMapSvg, type CellClickInfo, type CharacterClickInfo, type OverlayClickInfo } from "./TileMapSvg"
import { MapActionMenu } from "./MapActionMenu"
import { Dice5, RotateCcw } from "lucide-react"

interface MapPanelProps {
  scene: SceneState | null
  onSend?: (content: string) => void
}

type MenuState =
  | { type: "cell"; x: number; y: number; screenX: number; screenY: number }
  | { type: "character"; character: SceneState["characters"][number]; screenX: number; screenY: number }
  | { type: "overlay"; overlay: SceneOverlay; screenX: number; screenY: number }
  | null

export function MapPanel({ scene, onSend }: MapPanelProps) {
  const [menu, setMenu] = useState<MenuState>(null)
  const [replayTrigger, setReplayTrigger] = useState(0)

  const hasMovePaths = scene?.characters.some((c) => c.movePath && c.movePath.length >= 2)

  const handleCellClick = useCallback((info: CellClickInfo) => {
    setMenu({ type: "cell", x: info.x, y: info.y, screenX: info.screenX, screenY: info.screenY })
  }, [])

  const handleCharacterClick = useCallback((info: CharacterClickInfo) => {
    setMenu({ type: "character", character: info.character, screenX: info.screenX, screenY: info.screenY })
  }, [])

  const handleOverlayClick = useCallback((info: OverlayClickInfo) => {
    setMenu({ type: "overlay", overlay: info.overlay, screenX: info.screenX, screenY: info.screenY })
  }, [])

  const handleAction = useCallback(
    (event: string) => {
      onSend?.(event)
    },
    [onSend],
  )

  const handleCloseMenu = useCallback(() => {
    setMenu(null)
  }, [])

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

  if (!hasGrid) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground/50">
          <p className="text-sm font-medium">No map data yet</p>
        </div>
      </div>
    )
  }

  const menuTarget =
    menu?.type === "cell"
      ? { type: "cell" as const, x: menu.x, y: menu.y }
      : menu?.type === "character"
        ? { type: "character" as const, character: menu.character }
        : menu?.type === "overlay"
          ? { type: "overlay" as const, overlay: menu.overlay }
          : null

  return (
    <div className="relative h-full">
      <TileMapSvg
        map={scene.map}
        characters={scene.characters}
        replayTrigger={replayTrigger}
        onCellClick={handleCellClick}
        onCharacterClick={handleCharacterClick}
        onOverlayClick={handleOverlayClick}
      />
      {hasMovePaths && (
        <button
          className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg bg-card/80 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur hover:bg-card"
          onClick={() => setReplayTrigger((n) => n + 1)}
        >
          <RotateCcw className="h-3 w-3" />
          Replay
        </button>
      )}
      {menu && menuTarget && (
        <MapActionMenu
          position={{ x: menu.screenX, y: menu.screenY }}
          target={menuTarget}
          onAction={handleAction}
          onClose={handleCloseMenu}
        />
      )}
    </div>
  )
}
