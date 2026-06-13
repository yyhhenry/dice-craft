import { Hono } from "hono"
import fs from "fs"
import path from "path"
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

  router.get("/sessions/:id/voice/:filename", (c) => {
    const id = c.req.param("id")
    const filename = c.req.param("filename")
    if (!filename || filename.includes("..")) {
      return c.json({ error: "Invalid filename" }, 400)
    }
    const filePath = path.join("data", "sessions", id, "voice", filename)
    if (!fs.existsSync(filePath)) {
      return c.json({ error: "Not found" }, 404)
    }
    const buffer = fs.readFileSync(filePath)
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    })
  })

  return router
}
