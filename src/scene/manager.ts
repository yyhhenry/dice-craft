import fs from "fs"
import path from "path"
import type { SceneState, SceneMapCell } from "../shared/schemas"

const VALID_TERRAINS = new Set([
  "void", "grass", "stone", "wood", "dirt", "sand", "water", "wall", "lava", "ice",
])

function createEmptyState(sessionId: string): SceneState {
  return {
    sessionId,
    version: 0,
    dm: { id: "agent", name: "DM", status: "idle" },
    map: {},
    characters: [],
    updatedAt: new Date().toISOString(),
  }
}

interface HasId {
  id: string
  _remove?: boolean
}

function mergeById<T extends HasId>(existing: T[], incoming: HasId[]): T[] {
  const result = [...existing]
  for (const item of incoming) {
    if (item._remove) {
      const idx = result.findIndex((e) => e.id === item.id)
      if (idx >= 0) result.splice(idx, 1)
      continue
    }
    const idx = result.findIndex((e) => e.id === item.id)
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...item } as T
    } else {
      result.push(item as T)
    }
  }
  return result
}

export interface UpdateScenePatch {
  title?: string
  dm?: Record<string, unknown>
  map?: {
    title?: string
    mapFile?: string
    overlays?: HasId[]
    labels?: HasId[]
  }
  texts?: HasId[]
  characters?: HasId[]
  mainQuest?: {
    title?: string
    summary?: string
    objectives?: HasId[]
  }
  playerCard?: Record<string, unknown>
}

export class SceneManager {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  getState(sessionId: string): SceneState | null {
    const filePath = this.statePath(sessionId)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf-8"))
  }

  updateState(
    sessionId: string,
    patch: UpdateScenePatch,
    workspacePath: string,
  ): SceneState {
    const current = this.getState(sessionId) ?? createEmptyState(sessionId)

    if (patch.title !== undefined) current.title = patch.title
    if (patch.dm) current.dm = { ...current.dm, ...patch.dm } as SceneState["dm"]

    if (patch.map) {
      if (patch.map.title !== undefined) {
        current.map = { ...current.map, title: patch.map.title }
      }
      if (patch.map.mapFile) {
        const absPath = path.resolve(workspacePath, patch.map.mapFile)
        const parsed = this.parseMapFile(absPath)
        current.map = {
          ...current.map,
          width: parsed.width,
          height: parsed.height,
          cells: parsed.cells,
        }
      }
      if (patch.map.overlays) {
        current.map.overlays = mergeById(current.map.overlays ?? [], patch.map.overlays)
      }
      if (patch.map.labels) {
        current.map.labels = mergeById(current.map.labels ?? [], patch.map.labels)
      }
    }

    if (patch.texts) {
      current.texts = mergeById(current.texts ?? [], patch.texts)
    }
    if (patch.characters) {
      current.characters = mergeById(current.characters, patch.characters)
    }

    if (patch.mainQuest) {
      const mq = current.mainQuest ?? { title: "", objectives: [] }
      if (patch.mainQuest.title !== undefined) mq.title = patch.mainQuest.title
      if (patch.mainQuest.summary !== undefined) mq.summary = patch.mainQuest.summary
      if (patch.mainQuest.objectives) {
        mq.objectives = mergeById(mq.objectives, patch.mainQuest.objectives)
      }
      current.mainQuest = mq
    }

    if (patch.playerCard) {
      current.playerCard = {
        ...(current.playerCard ?? { id: "player", name: "Player" }),
        ...patch.playerCard,
      } as SceneState["playerCard"]
    }

    current.version++
    current.updatedAt = new Date().toISOString()

    const dir = path.dirname(this.statePath(sessionId))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.statePath(sessionId), JSON.stringify(current, null, 2))

    return current
  }

  parseMapFile(filePath: string): { width: number; height: number; cells: SceneMapCell[] } {
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))

    const cells: SceneMapCell[] = []
    let maxWidth = 0

    for (let y = 0; y < lines.length; y++) {
      const tokens = lines[y]!.split(",").map((t) => t.trim().toLowerCase())
      if (tokens.length > maxWidth) maxWidth = tokens.length
      for (let x = 0; x < tokens.length; x++) {
        const terrain = tokens[x]!
        if (!terrain || terrain === "void") continue
        cells.push({ x, y, terrain: VALID_TERRAINS.has(terrain) ? terrain : "void" })
      }
    }

    return { width: maxWidth, height: lines.length, cells }
  }

  private statePath(sessionId: string): string {
    return path.join(this.baseDir, "sessions", sessionId, "scene-state.json")
  }
}
