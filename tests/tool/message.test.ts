import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import os from "os"
import { ChatManager } from "../../src/chat/manager"
import { createMessageTool } from "../../src/tool/message"

describe("createMessageTool", () => {
  let tmpDir: string
  let chatManager: ChatManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "msg-tool-test-"))
    chatManager = new ChatManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("sends message to chat", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "hello" })
    expect(result.content).toBe("Message sent.")
    expect(result.isError).toBeFalsy()
    const msgs = chatManager.getMessages("sess_1")
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.content).toBe("hello")
    expect(msgs[0]!.senderRole).toBe("agent")
  })

  test("sends as npc with correct identity", async () => {
    chatManager.registerIdentity({ id: "npc_1", name: "酒馆老板", role: "npc" })
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "npc_1", "npc")
    await tool.execute({ content: "欢迎" })
    const msg = chatManager.getMessages("sess_1")[0]!
    expect(msg.senderRole).toBe("npc")
    expect(msg.senderName).toBe("酒馆老板")
  })

  test("calls onMessage callback", async () => {
    const received: string[] = []
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent", (c) =>
      received.push(c),
    )
    await tool.execute({ content: "test" })
    expect(received).toEqual(["test"])
  })

  test("returns error for empty content", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "" })
    expect(result.isError).toBe(true)
  })
})
