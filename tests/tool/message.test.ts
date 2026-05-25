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
    const result = await tool.execute({ content: "hello", sender_name: "GM" })
    expect(result.content).toBe("Message sent.")
    expect(result.isError).toBeFalsy()
    const msgs = chatManager.getMessages("sess_1")
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.content).toBe("hello")
    expect(msgs[0]!.senderRole).toBe("agent")
    expect(msgs[0]!.senderName).toBe("GM")
  })

  test("sends as npc with sender_name", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "npc_1", "npc")
    await tool.execute({ content: "欢迎", sender_name: "酒馆老板" })
    const msg = chatManager.getMessages("sess_1")[0]!
    expect(msg.senderRole).toBe("npc")
    expect(msg.senderName).toBe("酒馆老板")
  })

  test("calls onMessage callback with senderName and content", async () => {
    const received: Array<{ name: string; content: string }> = []
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent", (name, c) =>
      received.push({ name, content: c }),
    )
    await tool.execute({ content: "test", sender_name: "GM" })
    expect(received).toEqual([{ name: "GM", content: "test" }])
  })

  test("returns error for empty content", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "", sender_name: "GM" })
    expect(result.isError).toBe(true)
  })

  test("returns error for missing sender_name", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "hello" })
    expect(result.isError).toBe(true)
  })
})
