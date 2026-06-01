import { Hono } from "hono"
import { cors } from "hono/cors"
import { workspaceRoutes } from "./routes/workspaces"
import { sessionRoutes } from "./routes/sessions"
import type { WorkspaceManager } from "../workspace/manager"
import type { SessionManager } from "../session/manager"
import type { ChatManager } from "../chat/manager"
import type { SceneManager } from "../scene/manager"

export interface ServerDeps {
  workspaceManager: WorkspaceManager
  sessionManager: SessionManager
  chatManager: ChatManager
  sceneManager: SceneManager
}

export function createServer(deps: ServerDeps) {
  const app = new Hono()
  app.use("/*", cors())
  app.route("/api", workspaceRoutes(deps))
  app.route("/api", sessionRoutes(deps))
  return app
}
