import { SessionStore } from "../../src/session/store"
import { SessionManager } from "../../src/session/manager"
import type { WorkspaceID } from "../../src/workspace/types"
import fs from "fs"
import path from "path"
import os from "os"

export function createTestSessionManager(): {
  sessionManager: SessionManager
  workspaceId: WorkspaceID
  cleanup: () => void
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dice-craft-test-"))
  const store = new SessionStore(tmpDir)
  const sessionManager = new SessionManager(store)
  const workspaceId = "ws_test" as WorkspaceID
  return {
    sessionManager,
    workspaceId,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  }
}
