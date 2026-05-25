import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import os from "os"
import { ChatManager } from "../../src/chat/manager"

describe("ChatManager", () => {
  let tmpDir: string
  let manager: ChatManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-test-"))
    manager = new ChatManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("sendMessage persists to chat.jsonl", () => {
    manager.sendMessage("sess_1", { content: "hello", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    const messages = manager.getMessages("sess_1")
    expect(messages).toHaveLength(1)
    expect(messages[0]!.content).toBe("hello")
    expect(messages[0]!.sessionId).toBe("sess_1")
  })

  test("sendMessage stores sender info", () => {
    manager.sendMessage("sess_1", { content: "欢迎", senderId: "npc_1", senderName: "酒馆老板", senderRole: "npc" })
    const msg = manager.getMessages("sess_1")[0]!
    expect(msg.senderName).toBe("酒馆老板")
    expect(msg.senderRole).toBe("npc")
    expect(msg.senderId).toBe("npc_1")
  })

  test("sendMessage triggers listener", () => {
    const received: unknown[] = []
    manager.onMessage((msg) => received.push(msg))
    manager.sendMessage("sess_1", { content: "test", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    expect(received).toHaveLength(1)
    expect((received[0] as { content: string }).content).toBe("test")
  })

  test("getMessages returns empty for non-existent session", () => {
    expect(manager.getMessages("nope")).toEqual([])
  })

  test("getRecentMessages returns last N", () => {
    for (let i = 0; i < 10; i++) {
      manager.sendMessage("sess_1", { content: `msg_${i}`, senderId: "agent", senderName: "Agent", senderRole: "agent" })
    }
    const recent = manager.getRecentMessages("sess_1", 3)
    expect(recent).toHaveLength(3)
    expect(recent[0]!.content).toBe("msg_7")
    expect(recent[2]!.content).toBe("msg_9")
  })

  test("messages are appended, not overwritten", () => {
    manager.sendMessage("sess_1", { content: "first", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    manager.sendMessage("sess_1", { content: "second", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    const messages = manager.getMessages("sess_1")
    expect(messages).toHaveLength(2)
    expect(messages[0]!.content).toBe("first")
    expect(messages[1]!.content).toBe("second")
  })

  test("different sessions are independent", () => {
    manager.sendMessage("sess_1", { content: "a", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    manager.sendMessage("sess_2", { content: "b", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    expect(manager.getMessages("sess_1")).toHaveLength(1)
    expect(manager.getMessages("sess_2")).toHaveLength(1)
    expect(manager.getMessages("sess_1")[0]!.content).toBe("a")
    expect(manager.getMessages("sess_2")[0]!.content).toBe("b")
  })

  test("chat.jsonl is valid JSONL", () => {
    manager.sendMessage("sess_1", { content: "a", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    manager.sendMessage("sess_1", { content: "b", senderId: "agent", senderName: "Agent", senderRole: "agent" })
    const filePath = path.join(tmpDir, "sessions", "sess_1", "chat.jsonl")
    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n")
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})
