import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import { WorkspaceManager } from "../../src/workspace/manager"
import type { WorkspaceID, UserID } from "../../src/workspace/types"

const TEST_DIR = "/tmp/dicecraft-ws-test-" + Date.now()

function wsId(id: string): WorkspaceID {
  return id as WorkspaceID
}

function userId(id: string): UserID {
  return id as UserID
}

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

describe("WorkspaceManager", () => {
  let manager: WorkspaceManager

  beforeEach(() => {
    manager = new WorkspaceManager(TEST_DIR)
  })

  test("create workspace with correct structure", () => {
    const ws = manager.create(wsId("test-ws"), {
      name: "Test Workspace",
      ownerId: userId("user1"),
    })

    expect(ws.id).toBe(wsId("test-ws"))
    expect(ws.name).toBe("Test Workspace")
    expect(ws.ownerId).toBe(userId("user1"))
    expect(fs.existsSync(ws.path)).toBe(true)
    expect(fs.existsSync(ws.skillsDir)).toBe(true)
    expect(fs.existsSync(path.join(ws.path, "info.json"))).toBe(true)
  })

  test("get workspace by id", () => {
    manager.create(wsId("ws1"), { name: "WS1", ownerId: userId("u1") })

    const ws = manager.get(wsId("ws1"))
    expect(ws).toBeDefined()
    expect(ws?.name).toBe("WS1")
  })

  test("get returns undefined for nonexistent workspace", () => {
    expect(manager.get(wsId("nonexistent"))).toBeUndefined()
  })

  test("list all workspaces", () => {
    manager.create(wsId("ws1"), { name: "WS1", ownerId: userId("u1") })
    manager.create(wsId("ws2"), { name: "WS2", ownerId: userId("u2") })

    const list = manager.list()
    expect(list).toHaveLength(2)
  })

  test("listByUser filters by owner", () => {
    manager.create(wsId("ws1"), { name: "WS1", ownerId: userId("u1") })
    manager.create(wsId("ws2"), { name: "WS2", ownerId: userId("u2") })
    manager.create(wsId("ws3"), { name: "WS3", ownerId: userId("u1") })

    const list = manager.listByUser(userId("u1"))
    expect(list).toHaveLength(2)
    expect(list.every((ws) => ws.ownerId === "u1")).toBe(true)
  })

  test("delete workspace removes directory", () => {
    manager.create(wsId("ws1"), { name: "WS1", ownerId: userId("u1") })
    expect(manager.get(wsId("ws1"))).toBeDefined()

    manager.delete(wsId("ws1"))
    expect(manager.get(wsId("ws1"))).toBeUndefined()
  })

  test("initCLI creates default workspace", () => {
    const ws = manager.initCLI()
    expect(ws.id).toBe(wsId("cli"))
    expect(ws.name).toBe("CLI Workspace")
    expect(fs.existsSync(ws.path)).toBe(true)
    expect(fs.existsSync(ws.skillsDir)).toBe(true)
  })

  test("initCLI returns existing workspace on second call", () => {
    const ws1 = manager.initCLI()
    const ws2 = manager.initCLI()
    expect(ws1.id).toBe(ws2.id)
    expect(ws1.createdAt).toBe(ws2.createdAt)
  })
})
