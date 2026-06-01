import { Hono } from "hono"
import { WorkspaceConfigSchema } from "../../shared/schemas"
import type { ServerDeps } from "../index"
import { type WorkspaceID, type UserID, generateWorkspaceID } from "../../workspace/types"

export function workspaceRoutes(deps: ServerDeps) {
  const router = new Hono()

  router.get("/workspaces", (c) => {
    return c.json(deps.workspaceManager.list())
  })

  router.post("/workspaces", async (c) => {
    const body = await c.req.json()
    const name = body.name as string
    if (!name || name.trim().length === 0) {
      return c.json({ error: "Name is required" }, 400)
    }
    const id = generateWorkspaceID()
    const ws = deps.workspaceManager.create(id, { name: name.trim(), ownerId: "local" as UserID })
    return c.json(ws, 201)
  })

  router.get("/workspaces/:id/config", (c) => {
    const id = c.req.param("id") as WorkspaceID
    const config = deps.workspaceManager.getConfig(id)
    if (!config) return c.json({ apiBaseUrl: "", apiKey: "", modelName: "" })
    const masked = { ...config, apiKey: config.apiKey.slice(0, 6) + "..." }
    return c.json(masked)
  })

  router.put("/workspaces/:id/config", async (c) => {
    const id = c.req.param("id") as WorkspaceID
    const ws = deps.workspaceManager.get(id)
    if (!ws) return c.json({ error: "Workspace not found" }, 404)

    const body = await c.req.json()
    const parsed = WorkspaceConfigSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

    deps.workspaceManager.setConfig(id, parsed.data)
    return c.json(parsed.data)
  })

  return router
}
