import fs from "fs"
import path from "path"
import { type WorkspaceID, type UserID, type WorkspaceInfo } from "./types"

export class WorkspaceManager {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
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

    const info: WorkspaceInfo = {
      id,
      name: opts.name,
      ownerId: opts.ownerId,
      path: wsPath,
      skillsDir,
      createdAt: new Date().toISOString(),
    }

    const infoPath = path.join(wsPath, "info.json")
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2))

    return info
  }

  get(id: WorkspaceID): WorkspaceInfo | undefined {
    const infoPath = path.join(this.baseDir, id, "info.json")
    if (!fs.existsSync(infoPath)) return undefined
    return JSON.parse(fs.readFileSync(infoPath, "utf-8"))
  }

  list(): WorkspaceInfo[] {
    if (!fs.existsSync(this.baseDir)) return []
    return fs.readdirSync(this.baseDir)
      .map((id) => this.get(id as WorkspaceID))
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
  }
}
