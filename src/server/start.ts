import { createServer } from "./index"
import { WorkspaceManager } from "../workspace/manager"
import { SessionStore } from "../session/store"
import { SessionManager } from "../session/manager"
import { ChatManager } from "../chat/manager"
import { type WorkspaceID, type UserID } from "../workspace/types"

export async function startServer(port = 3001) {
  const workspaceManager = new WorkspaceManager("data/workspaces")

  if (workspaceManager.list().length === 0) {
    workspaceManager.create("ws_default" as WorkspaceID, {
      name: "Default Workspace",
      ownerId: "local" as UserID,
    })
  }

  const sessionStore = new SessionStore("data")
  const sessionManager = new SessionManager(sessionStore)
  const chatManager = new ChatManager("data")

  const app = createServer({ workspaceManager, sessionManager, chatManager })

  Bun.serve({
    port,
    fetch: app.fetch,
  })

  console.log(`Server running on http://localhost:${port}`)
}
