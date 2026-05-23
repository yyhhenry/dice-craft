import fs from "fs"
import path from "path"
import type { WorkspaceID } from "../workspace/types"
import type { SessionInfo, StoredMessage } from "./types"

export class SessionStore {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  private sessionDir(sessionId: string): string {
    return path.join(this.baseDir, "sessions", sessionId)
  }

  readSessionInfo(sessionId: string): SessionInfo | undefined {
    const infoPath = path.join(this.sessionDir(sessionId), "info.json")
    if (!fs.existsSync(infoPath)) return undefined
    return JSON.parse(fs.readFileSync(infoPath, "utf-8"))
  }

  writeSessionInfo(info: SessionInfo): void {
    const dir = this.sessionDir(info.id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify(info, null, 2))
  }

  appendMessage(sessionId: string, message: StoredMessage): void {
    const dir = this.sessionDir(sessionId)
    fs.mkdirSync(dir, { recursive: true })
    const line = JSON.stringify(message) + "\n"
    fs.appendFileSync(path.join(dir, "messages.jsonl"), line)
  }

  readMessages(sessionId: string): StoredMessage[] {
    const filePath = path.join(this.sessionDir(sessionId), "messages.jsonl")
    if (!fs.existsSync(filePath)) return []
    const content = fs.readFileSync(filePath, "utf-8")
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
  }

  listWorkspaceSessions(workspaceId: WorkspaceID): string[] {
    const sessionsDir = path.join(this.baseDir, "sessions")
    if (!fs.existsSync(sessionsDir)) return []
    return fs.readdirSync(sessionsDir).filter((id) => {
      const info = this.readSessionInfo(id)
      return info?.workspaceId === workspaceId
    })
  }

  deleteSession(sessionId: string): void {
    const dir = this.sessionDir(sessionId)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}
