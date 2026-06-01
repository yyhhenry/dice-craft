export const CELL_SIZE = 40

export interface TerrainDef {
  id: string
  char: string
  color: string
}

export const TERRAIN_DEFS: TerrainDef[] = [
  { id: "void", char: ".", color: "#1a1a2e" },
  { id: "grass", char: "g", color: "#4a8c3f" },
  { id: "stone", char: "s", color: "#808080" },
  { id: "wood", char: "f", color: "#8b6914" },
  { id: "dirt", char: "d", color: "#7a6040" },
  { id: "sand", char: "a", color: "#d4b896" },
  { id: "water", char: "w", color: "#3070b0" },
  { id: "wall", char: "W", color: "#5a4a3a" },
  { id: "lava", char: "l", color: "#c03010" },
  { id: "ice", char: "i", color: "#a0d0e8" },
]

const TERRAIN_COLOR_MAP = new Map(TERRAIN_DEFS.map((t) => [t.id, t.color]))

export function getTerrainColor(terrainId: string): string {
  return TERRAIN_COLOR_MAP.get(terrainId) ?? TERRAIN_COLOR_MAP.get("void")!
}

export const ROLE_COLORS: Record<string, string> = {
  player: "#4a90d9",
  ally: "#d4a940",
  npc: "#50b050",
  enemy: "#c04040",
  neutral: "#909090",
}

export const OVERLAY_SYMBOLS: Record<string, string> = {
  door: "🚪",
  chest: "📦",
  trap: "⚠",
  stairs: "🪜",
  marker: "◆",
}
