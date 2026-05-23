import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import { SessionManager } from "../../src/session/manager"
import { SessionStore } from "../../src/session/store"
import type { WorkspaceID } from "../../src/workspace/types"

const TEST_DIR = "/tmp/dicecraft-session-test-" + Date.now()

function wsId(id: string): WorkspaceID {
  return id as WorkspaceID
}

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

describe("SessionManager", () => {
  let manager: SessionManager

  beforeEach(() => {
    const store = new SessionStore(TEST_DIR)
    manager = new SessionManager(store)
  })

  test("create session with correct info", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
      title: "Test Session",
    })

    expect(session.id).toMatch(/^sess_\d+_[a-z0-9]+$/)
    expect(session.workspaceId).toBe(wsId("ws1"))
    expect(session.agentType).toBe("builder")
    expect(session.title).toBe("Test Session")
    expect(session.messageCount).toBe(0)
  })

  test("get session by id", () => {
    const created = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
    })

    const session = manager.get(created.id)
    expect(session).toBeDefined()
    expect(session?.id).toBe(created.id)
  })

  test("get returns undefined for nonexistent session", () => {
    expect(manager.get("nonexistent")).toBeUndefined()
  })

  test("listByWorkspace returns sessions without parent", () => {
    manager.create({ workspaceId: wsId("ws1"), agentType: "builder", title: "Main 1" })
    manager.create({ workspaceId: wsId("ws1"), agentType: "builder", title: "Main 2" })
    manager.create({ workspaceId: wsId("ws2"), agentType: "builder", title: "Other" })

    const list = manager.listByWorkspace(wsId("ws1"))
    expect(list).toHaveLength(2)
    expect(list.every((s) => s.workspaceId === wsId("ws1"))).toBe(true)
  })

  test("listByWorkspace excludes subagent sessions", () => {
    const parent = manager.create({ workspaceId: wsId("ws1"), agentType: "builder" })
    manager.create({
      workspaceId: wsId("ws1"),
      agentType: "explore",
      parentSessionId: parent.id,
    })

    const list = manager.listByWorkspace(wsId("ws1"))
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(parent.id)
  })

  test("listSubagents returns children of parent", () => {
    const parent = manager.create({ workspaceId: wsId("ws1"), agentType: "builder" })
    manager.create({
      workspaceId: wsId("ws1"),
      agentType: "explore",
      parentSessionId: parent.id,
    })
    manager.create({
      workspaceId: wsId("ws1"),
      agentType: "review",
      parentSessionId: parent.id,
    })

    const subagents = manager.listSubagents(parent.id)
    expect(subagents).toHaveLength(2)
    expect(subagents.every((s) => s.parentSessionId === parent.id)).toBe(true)
  })

  test("appendMessage increments messageCount", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
    })

    manager.appendMessage(session.id, { role: "user", content: "Hello" })
    manager.appendMessage(session.id, { role: "assistant", content: "Hi!" })

    const updated = manager.get(session.id)
    expect(updated?.messageCount).toBe(2)
  })

  test("getMessages returns all messages", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
    })

    manager.appendMessage(session.id, { role: "user", content: "Hello" })
    manager.appendMessage(session.id, { role: "assistant", content: "Hi!" })

    const messages = manager.getMessages(session.id)
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe("user")
    expect(messages[0]!.content).toBe("Hello")
    expect(messages[1]!.role).toBe("assistant")
    expect(messages[1]!.content).toBe("Hi!")
  })

  test("messages have _meta after append", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
    })

    const stored = manager.appendMessage(session.id, { role: "user", content: "test" })
    expect(stored._meta).toBeDefined()
    expect(stored._meta?.id).toMatch(/^msg_/)
    expect(stored._meta?.timestamp).toBeTruthy()
  })

  test("update session title", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
      title: "Original",
    })

    manager.update(session.id, { title: "Updated" })

    const updated = manager.get(session.id)
    expect(updated?.title).toBe("Updated")
  })

  test("delete session removes it", () => {
    const session = manager.create({
      workspaceId: wsId("ws1"),
      agentType: "builder",
    })

    manager.delete(session.id)
    expect(manager.get(session.id)).toBeUndefined()
  })
})
