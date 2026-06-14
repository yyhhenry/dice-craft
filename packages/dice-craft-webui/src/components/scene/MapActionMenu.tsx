import { useRef, useEffect } from "react"
import type { SceneCharacter } from "@shared/schemas"

interface MapActionMenuProps {
  position: { x: number; y: number }
  target: { type: "cell"; x: number; y: number } | { type: "character"; character: SceneCharacter }
  onAction: (event: string) => void
  onClose: () => void
}

export function MapActionMenu({ position, target, onAction, onClose }: MapActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const items: { label: string; event: string }[] = []

  if (target.type === "cell") {
    items.push({
      label: "移动到这里",
      event: `<event source="map" type="move" x="${target.x}" y="${target.y}"/>`,
    })
  } else {
    const hasActions = target.character.actions && target.character.actions.length > 0
    if (!hasActions) {
      if (target.character.role === "player") {
        items.push({ label: "不能与自己交互", event: "" })
      } else {
        items.push({
          label: "互动",
          event: `<event source="map" type="interact" character="${target.character.name}"/>`,
        })
      }
    }
    if (hasActions) {
      for (const action of target.character.actions) {
        items.push({
          label: action.label,
          event: `<event source="map" type="action" character="${target.character.name}" action="${action.id}"/>`,
        })
      }
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-32 rounded-lg border bg-popover p-1 shadow-md"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item) =>
        item.event ? (
          <button
            key={item.event}
            className="flex w-full items-center rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onAction(item.event)
              onClose()
            }}
          >
            {item.label}
          </button>
        ) : (
          <button
            key={item.label}
            className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            onClick={onClose}
          >
            {item.label}
          </button>
        ),
      )}
      <button
        className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        onClick={onClose}
      >
        取消
      </button>
    </div>
  )
}
