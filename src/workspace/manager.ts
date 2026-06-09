import fs from "fs"
import path from "path"
import { type WorkspaceID, type UserID, type WorkspaceInfo } from "./types"
import { WorkspaceConfigSchema, type WorkspaceConfig } from "../shared/schemas"
import { loadTemplates } from "./templates.macro" with { type: "macro" }

// At bundle time, this becomes a literal { "skills/dice/SKILL.md": "...", ... }
const TEMPLATES = loadTemplates()

export class WorkspaceManager {
  private baseDir: string
  private metaDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
    this.metaDir = path.join(this.baseDir, ".meta")
  }

  initCLI(): WorkspaceInfo {
    const id = "cli" as WorkspaceID
    const existing = this.get(id)
    if (existing) return existing
    return this.create(id, { name: "CLI Workspace", ownerId: "local" as UserID })
  }

  create(id: WorkspaceID, opts: { name: string; ownerId: UserID }): WorkspaceInfo {
    const wsPath = path.join(this.baseDir, id)
    const skillsDir = path.join(wsPath, "skills")

    fs.mkdirSync(skillsDir, { recursive: true })
    fs.mkdirSync(this.metaDir, { recursive: true })

    // Write template files into workspace
    for (const [relPath, content] of Object.entries(TEMPLATES)) {
      const filePath = path.join(wsPath, relPath)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content)
    }

    const info: WorkspaceInfo = {
      id,
      name: opts.name,
      ownerId: opts.ownerId,
      path: wsPath,
      skillsDir,
      createdAt: new Date().toISOString(),
    }

    const metaPath = path.join(this.metaDir, `${id}.json`)
    fs.writeFileSync(metaPath, JSON.stringify(info, null, 2))

    return info
  }

  get(id: WorkspaceID): WorkspaceInfo | undefined {
    const metaPath = path.join(this.metaDir, `${id}.json`)
    if (!fs.existsSync(metaPath)) return undefined
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"))
  }

  list(): WorkspaceInfo[] {
    if (!fs.existsSync(this.metaDir)) return []
    return fs
      .readdirSync(this.metaDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.metaDir, f), "utf-8"))
        } catch {
          return undefined
        }
      })
      .filter((ws): ws is WorkspaceInfo => ws !== undefined)
  }

  listByUser(userId: UserID): WorkspaceInfo[] {
    return this.list().filter((ws) => ws.ownerId === userId)
  }

  delete(id: WorkspaceID): void {
    const wsPath = path.join(this.baseDir, id)
    if (fs.existsSync(wsPath)) {
      fs.rmSync(wsPath, { recursive: true, force: true })
    }
    const metaPath = path.join(this.metaDir, `${id}.json`)
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath)
    }
  }

  getConfig(id: WorkspaceID): WorkspaceConfig | undefined {
    const configPath = path.join(this.metaDir, `${id}-config.json`)
    if (!fs.existsSync(configPath)) return undefined
    return WorkspaceConfigSchema.parse(JSON.parse(fs.readFileSync(configPath, "utf-8")))
  }

  setConfig(id: WorkspaceID, config: WorkspaceConfig): void {
    fs.mkdirSync(this.metaDir, { recursive: true })
    fs.writeFileSync(path.join(this.metaDir, `${id}-config.json`), JSON.stringify(config, null, 2))
  }
}
