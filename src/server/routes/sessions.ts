import { Hono } from "hono"
import type { ServerDeps } from "../index"
import type { WorkspaceID } from "../../workspace/types"

export function sessionRoutes(deps: ServerDeps) {
  const router = new Hono()

  router.get("/workspaces/:id/sessions", (c) => {
    const id = c.req.param("id") as WorkspaceID
    const sessions = deps.sessionManager.listByWorkspace(id)
    return c.json(sessions)
  })

  router.post("/workspaces/:id/sessions", async (c) => {
    const id = c.req.param("id") as WorkspaceID
    const ws = deps.workspaceManager.get(id)
    if (!ws) return c.json({ error: "Workspace not found" }, 404)

    const body = await c.req.json()
    const title = (body.title as string)?.trim() || "New conversation"
    const session = deps.sessionManager.create({
      workspaceId: id,
      agentType: "primary",
      title,
    })
    return c.json(session, 201)
  })

  router.get("/sessions/:id/messages", (c) => {
    const id = c.req.param("id")
    const messages = deps.chatManager.getMessages(id)
    return c.json(messages)
  })

  router.get("/sessions/:id/scene", (c) => {
    const id = c.req.param("id")
    const state = deps.sceneManager.getState(id)
    if (!state) {
      return c.json({
        sessionId: id,
        version: 0,
        dm: { id: "agent", name: "DM", status: "idle" },
        map: {},
        characters: [],
        updatedAt: new Date().toISOString(),
      })
    }
    return c.json(state)
  })

  router.delete("/sessions/:id", (c) => {
    const id = c.req.param("id")
    const session = deps.sessionManager.get(id)
    if (!session) return c.json({ error: "Session not found" }, 404)
    deps.sessionManager.delete(id)
    return c.json({ ok: true })
  })

  router.post("/sessions/:id/messages", (c) => {
    return c.json({ error: "Not implemented" }, 501)
  })

  return router
}
