export const CELL_SIZE = 40

export interface TerrainDef {
  id: string
  color: string
  pattern: PatternElement[]
}

export interface PatternElement {
  type: "rect" | "circle"
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  fill: string
  opacity?: number
}

const P = 8

function dots(base: string, dotColor: string, positions: [number, number][]): PatternElement[] {
  return [
    { type: "rect", x: 0, y: 0, w: P, h: P, fill: base },
    ...positions.map(([x, y]): PatternElement => ({
      type: "rect", x, y, w: 1, h: 1, fill: dotColor, opacity: 0.5,
    })),
  ]
}

function bricks(base: string, lineColor: string): PatternElement[] {
  return [
    { type: "rect", x: 0, y: 0, w: P, h: P, fill: base },
    { type: "rect", x: 0, y: 3, w: P, h: 1, fill: lineColor, opacity: 0.3 },
    { type: "rect", x: 0, y: 7, w: P, h: 1, fill: lineColor, opacity: 0.3 },
    { type: "rect", x: 3, y: 0, w: 1, h: 3, fill: lineColor, opacity: 0.3 },
    { type: "rect", x: 7, y: 4, w: 1, h: 3, fill: lineColor, opacity: 0.3 },
  ]
}

function stripes(base: string, lineColor: string, positions: number[]): PatternElement[] {
  return [
    { type: "rect", x: 0, y: 0, w: P, h: P, fill: base },
    ...positions.map((y): PatternElement => ({
      type: "rect", x: 0, y, w: P, h: 1, fill: lineColor, opacity: 0.25,
    })),
  ]
}

export const TERRAIN_DEFS: TerrainDef[] = [
  {
    id: "void",
    color: "#1a1a2e",
    pattern: [{ type: "rect", x: 0, y: 0, w: P, h: P, fill: "#1a1a2e" }],
  },
  {
    id: "grass",
    color: "#4a8c3f",
    pattern: dots("#4a8c3f", "#3a7030", [[1, 2], [5, 1], [3, 5], [6, 6], [0, 7], [7, 3]]),
  },
  {
    id: "stone",
    color: "#808080",
    pattern: bricks("#808080", "#606060"),
  },
  {
    id: "wood",
    color: "#8b6914",
    pattern: stripes("#8b6914", "#6b5010", [2, 5, 7]),
  },
  {
    id: "dirt",
    color: "#7a6040",
    pattern: dots("#7a6040", "#604830", [[2, 1], [5, 3], [1, 6], [7, 5], [4, 7]]),
  },
  {
    id: "sand",
    color: "#d4b896",
    pattern: dots("#d4b896", "#c0a080", [[1, 3], [4, 1], [6, 5], [3, 7], [7, 2]]),
  },
  {
    id: "water",
    color: "#3070b0",
    pattern: [
      { type: "rect", x: 0, y: 0, w: P, h: P, fill: "#3070b0" },
      { type: "rect", x: 1, y: 2, w: 3, h: 1, fill: "#4090d0", opacity: 0.4 },
      { type: "rect", x: 5, y: 5, w: 2, h: 1, fill: "#4090d0", opacity: 0.4 },
    ],
  },
  {
    id: "wall",
    color: "#5a4a3a",
    pattern: bricks("#5a4a3a", "#3a3028"),
  },
  {
    id: "lava",
    color: "#c03010",
    pattern: [
      { type: "rect", x: 0, y: 0, w: P, h: P, fill: "#c03010" },
      { type: "rect", x: 2, y: 1, w: 2, h: 2, fill: "#e06020", opacity: 0.5 },
      { type: "rect", x: 5, y: 5, w: 2, h: 2, fill: "#e06020", opacity: 0.5 },
      { type: "rect", x: 1, y: 6, w: 1, h: 1, fill: "#ff8040", opacity: 0.4 },
    ],
  },
  {
    id: "ice",
    color: "#a0d0e8",
    pattern: [
      { type: "rect", x: 0, y: 0, w: P, h: P, fill: "#a0d0e8" },
      { type: "rect", x: 1, y: 1, w: 3, h: 1, fill: "#c0e8ff", opacity: 0.5 },
      { type: "rect", x: 4, y: 5, w: 2, h: 1, fill: "#c0e8ff", opacity: 0.5 },
    ],
  },
]

export const PATTERN_SIZE = P

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
