import type { ServerWebSocket } from "bun"
import { createServer } from "./index"
import { WorkspaceManager } from "../workspace/manager"
import { SessionStore } from "../session/store"
import { SessionManager } from "../session/manager"
import { ChatManager } from "../chat/manager"
import { type WorkspaceID, type UserID } from "../workspace/types"
import { AppPool } from "./app-pool"
import { WsManager, type WsData } from "./ws"

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

  const appPool = new AppPool({ workspaceManager, sessionManager, chatManager })
  const wsManager = new WsManager(appPool, sessionManager, chatManager)

  const honoApp = createServer({ workspaceManager, sessionManager, chatManager })

  Bun.serve<WsData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url)

      // WebSocket upgrade: /api/ws/sessions/:id
      const wsMatch = url.pathname.match(/^\/api\/ws\/sessions\/(.+)$/)
      if (wsMatch && req.headers.get("upgrade") === "websocket") {
        const sessionId = wsMatch[1]!
        const workspaceId = url.searchParams.get("workspaceId") as WorkspaceID | null
        if (!sessionId || !workspaceId) {
          return new Response("Missing sessionId or workspaceId", { status: 400 })
        }
        const success = server.upgrade(req, { data: { sessionId, workspaceId } })
        if (success) return undefined
        return new Response("WebSocket upgrade failed", { status: 500 })
      }

      // Regular HTTP — delegate to Hono
      return honoApp.fetch(req, server)
    },
    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        wsManager.open(ws)
      },
      message(ws: ServerWebSocket<WsData>, raw) {
        wsManager.message(ws, raw)
      },
      close(ws: ServerWebSocket<WsData>) {
        wsManager.close(ws)
      },
    },
  })

  console.log(`Server running on http://localhost:${port}`)
}
