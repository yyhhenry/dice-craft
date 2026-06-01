import fs from "fs"
import path from "path"
import type { SceneState, SceneMapCell } from "../shared/schemas"

function createEmptyState(sessionId: string): SceneState {
  return {
    sessionId,
    version: 0,
    map: {},
    characters: [],
    updatedAt: new Date().toISOString(),
  }
}

export interface UpdateScenePatch {
  title?: string
  map?: {
    title?: string
    mapFile?: string
    overlays?: Record<string, unknown>[]
    labels?: Record<string, unknown>[]
  }
  characters?: Record<string, unknown>[]
  mainQuest?: Record<string, unknown>
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

  updateState(sessionId: string, patch: UpdateScenePatch, workspacePath: string): SceneState {
    const current = this.getState(sessionId) ?? createEmptyState(sessionId)

    if (patch.title !== undefined) current.title = patch.title

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
        current.map.overlays = patch.map.overlays as SceneState["map"]["overlays"]
      }
      if (patch.map.labels) {
        current.map.labels = patch.map.labels as SceneState["map"]["labels"]
      }
    }

    if (patch.characters) {
      current.characters = patch.characters as SceneState["characters"]
    }

    if (patch.mainQuest) {
      current.mainQuest = patch.mainQuest as SceneState["mainQuest"]
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
    const lines = content.split("\n").filter((line) => line.trim() && !line.startsWith("#"))

    const cells: SceneMapCell[] = []
    let maxWidth = 0

    for (let y = 0; y < lines.length; y++) {
      const tokens = lines[y]!.split(",").map((t) => t.trim().toLowerCase())
      if (tokens.length > maxWidth) maxWidth = tokens.length
      for (let x = 0; x < tokens.length; x++) {
        const terrain = tokens[x]!
        if (!terrain || terrain === "void") continue
        cells.push({ x, y, terrain })
      }
    }

    return { width: maxWidth, height: lines.length, cells }
  }

  private statePath(sessionId: string): string {
    return path.join(this.baseDir, "sessions", sessionId, "scene-state.json")
  }
}
