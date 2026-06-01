export const CELL_SIZE = 40
export const PATTERN_SIZE = 16

export interface TerrainDef {
  id: string
  pixels: string[]
  palette: Record<string, string>
}

// Each terrain is a 16x16 pixel art tile.
// Characters in the pixel grid map to hex colors via the palette.

export const TERRAIN_DEFS: TerrainDef[] = [
  {
    id: "void",
    palette: { a: "#15152a", b: "#1a1a30", c: "#121228" },
    pixels: [
      "aabaabaabaabaaba",
      "abaabaabaabaabaa",
      "baabaacaabaabacb",
      "aabaabaabaabaaba",
      "abaabaabaabaabaa",
      "baabaabaabaabacb",
      "aabaabaacaabaaba",
      "abaabaabaabaabaa",
      "aabaabaabaabaaba",
      "abaabaabaabaabaa",
      "baabaabaabaabacb",
      "aabaabaabaabaaba",
      "abaabaacaabaabaa",
      "baabaabaabaabacb",
      "aabaabaabaabaaba",
      "abaabaabaabaabaa",
    ],
  },
  {
    id: "grass",
    palette: {
      a: "#3a7a35",
      b: "#4a9a42",
      c: "#2d6628",
      d: "#5ab050",
      e: "#8ac050",
      f: "#306020",
    },
    pixels: [
      "aabaabaabcabaaba",
      "baababaababaabba",
      "abcaababaababaab",
      "baababeababdabba",
      "aababaababaabcab",
      "babcababdababaab",
      "aababaababaababf",
      "baababaababeabba",
      "aabdabaababaabab",
      "baababaababaabca",
      "abcaababaababaab",
      "baababaababaabba",
      "aababeababaabcab",
      "baababaababdabba",
      "abfaababaababaab",
      "baababaababaabba",
    ],
  },
  {
    id: "stone",
    palette: {
      a: "#909090",
      b: "#787878",
      c: "#686868",
      d: "#a0a0a0",
      e: "#585858",
    },
    pixels: [
      "aabbaaadddaabbcc",
      "abbaaddddddabbce",
      "bbaaadddddaabbce",
      "baaaddddddaabbce",
      "aaadddddddaabbce",
      "eeeeeeeeeeeeeeee",
      "ddaabbccaaabbbdd",
      "daabbcccaaabbbdd",
      "aabbccccaaabbbdd",
      "abbcccccaaabbbdd",
      "bbccccccaaabbbdd",
      "eeeeeeeeeeeeeeee",
      "aabbaaadddaabbcc",
      "abbaaddddddabbce",
      "bbaaadddddaabbce",
      "baaaddddddaabbce",
    ],
  },
  {
    id: "wood",
    palette: {
      a: "#8a6520",
      b: "#7a5518",
      c: "#6a4510",
      d: "#9a7530",
      e: "#4a3008",
      f: "#aa8540",
    },
    pixels: [
      "aabadaabadaabada",
      "aabadaabadaabada",
      "aabadaabadaabada",
      "dabadaabadaabada",
      "aabadaabadaabada",
      "aabadaabadaabfda",
      "aabadaabadaabada",
      "ffffffffffffffff",
      "bcbadbbcbdbbcbad",
      "bcbadbbcbdbbcbad",
      "bcbadbbcbdbbcbad",
      "bcbadbbcbdbbcbad",
      "bcbadbbcbdbbcbad",
      "bcfadbbcbdbbcbad",
      "bcbadbbcbdbbcbad",
      "ffffffffffffffff",
    ],
  },
  {
    id: "dirt",
    palette: {
      a: "#7a6040",
      b: "#6a5030",
      c: "#8a7050",
      d: "#5a4028",
      e: "#9a8060",
      f: "#a09070",
    },
    pixels: [
      "aabcabaabcababab",
      "bcaababaababcabb",
      "aababdababaababc",
      "babcababdabcabab",
      "aababaababeababd",
      "bcababaababaabcb",
      "aababdababcababf",
      "baabababababcaba",
      "abcaababdababaab",
      "baababaababeabba",
      "aababfababaabcab",
      "bcababaababaabab",
      "ababdababcababcb",
      "baababaababaabba",
      "aababaababdababf",
      "bcababeababaabab",
    ],
  },
  {
    id: "sand",
    palette: {
      a: "#d4b896",
      b: "#c8a882",
      c: "#dcc8a6",
      d: "#bfa078",
      e: "#e8d8b8",
    },
    pixels: [
      "aabcaabaabcaabaa",
      "baaababaababaabb",
      "aababaababaababc",
      "baaababeababaabb",
      "aabcaabaabaaabac",
      "baaababaababaabb",
      "aababdababaababc",
      "baaababaababeabb",
      "aabcaabaabcaabaa",
      "baaababaababaabb",
      "aababaababaababd",
      "baaababeababaabb",
      "aabcaabaabaaabac",
      "baaababaababaabb",
      "aababdababaababc",
      "baaababaababeabb",
    ],
  },
  {
    id: "water",
    palette: {
      a: "#2868a8",
      b: "#3078b8",
      c: "#2060a0",
      d: "#4090d0",
      e: "#50a0e0",
      f: "#185088",
    },
    pixels: [
      "aabaabaacaabaaba",
      "baabaabaabaabbaa",
      "aabddeaabaabaabc",
      "baabaabaabaabaab",
      "aabaabaabaabaaba",
      "baabaabaabaabbaa",
      "aabaabaacaabaaba",
      "baabaabaabaabaab",
      "aabaabaabaddeaba",
      "baabaabaabaabbaa",
      "aabaabaacaabaaba",
      "baabaabaabaabaab",
      "ddbaabaabaabddba",
      "aabaabaabaabaaba",
      "baabaabaabaabbaa",
      "aabaabaacaabaaba",
    ],
  },
  {
    id: "wall",
    palette: {
      a: "#5a4a3a",
      b: "#6a5a48",
      c: "#4a3a2a",
      d: "#3a2a1a",
      e: "#7a6a58",
    },
    pixels: [
      "dddddddddddddddd",
      "dabbbbbbdcccccced",
      "dabbbbbbdcccccced",
      "dabbbbbbdcccccced",
      "dabbbbebdccccccad",
      "dabbbbbbdcccccced",
      "dabbbbbbdcccccced",
      "dddddddddddddddd",
      "dddddddddddddddd",
      "dcccccaddabbbbbbd",
      "dccccceddabbabbbd",
      "dcccccaddabbbbbbd",
      "dccccceddabbbbbbd",
      "dcccccaddabbbebbd",
      "dccccceddabbbbbbd",
      "dddddddddddddddd",
    ],
  },
  {
    id: "lava",
    palette: {
      a: "#b02808",
      b: "#d04010",
      c: "#e06820",
      d: "#f0a040",
      e: "#ffc060",
      f: "#901808",
    },
    pixels: [
      "aabbaabaafaabaab",
      "baaababaababaabb",
      "aababcababaababf",
      "baacddbababaabba",
      "aabcddcaababaabf",
      "baabccbaababaabb",
      "aababaababfababf",
      "baaababaababaabb",
      "aabfaabaababaabf",
      "baaababaababaabb",
      "aababaababcababf",
      "baaababaacddabba",
      "aabfababcdddaabf",
      "baaababaacddabbb",
      "aababfababcababf",
      "baaababaababaabb",
    ],
  },
  {
    id: "ice",
    palette: {
      a: "#a0d0e8",
      b: "#b8e0f0",
      c: "#90c0d8",
      d: "#d0f0ff",
      e: "#80b0c8",
    },
    pixels: [
      "aabaabaabaabaaba",
      "baababaababaabba",
      "aababdababaababc",
      "baababaababaabba",
      "aabaabaababdabab",
      "baababaababaabba",
      "aababaababaababc",
      "dddbaababaababba",
      "aabddbaababaabab",
      "baababddbaababba",
      "aababaabddababbc",
      "baababaababaabba",
      "aababaababaababd",
      "baababdababaabba",
      "aababaababdababc",
      "baababaababaabba",
    ],
  },
]

const TERRAIN_DEF_MAP = new Map(TERRAIN_DEFS.map((t) => [t.id, t]))

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function adjustColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = clamp(r + amount)
  const ng = clamp(g + amount)
  const nb = clamp(b + amount)
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`
}

function adjustPalette(palette: Record<string, string>, amount: number): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(palette)) {
    result[k] = adjustColor(v, amount)
  }
  return result
}

const MODIFIER_SHIFTS: Record<string, number> = {
  dark: -35,
  light: 30,
}

export interface ResolvedPattern {
  pixels: string[]
  palette: Record<string, string>
}

export function resolveTerrainPattern(id: string): ResolvedPattern {
  const existing = TERRAIN_DEF_MAP.get(id)
  if (existing) return { pixels: existing.pixels, palette: existing.palette }

  const dotIdx = id.indexOf(".")
  if (dotIdx > 0) {
    const base = id.slice(0, dotIdx)
    const modifier = id.slice(dotIdx + 1)
    const baseDef = TERRAIN_DEF_MAP.get(base)
    if (baseDef) {
      const shift = MODIFIER_SHIFTS[modifier]
      if (shift !== undefined) {
        return { pixels: baseDef.pixels, palette: adjustPalette(baseDef.palette, shift) }
      }
      return { pixels: baseDef.pixels, palette: baseDef.palette }
    }
  }

  const voidDef = TERRAIN_DEF_MAP.get("void")!
  return { pixels: voidDef.pixels, palette: voidDef.palette }
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
