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

  test("sends message to chat with role and avatar", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "hello", sender_name: "GM", role: "agent" })
    expect(result.content).toBe("Message sent.")
    expect(result.isError).toBeFalsy()
    const msgs = chatManager.getMessages("sess_1")
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.content).toBe("hello")
    expect(msgs[0]!.senderRole).toBe("agent")
    expect(msgs[0]!.senderName).toBe("GM")
  })

  test("sends as npc role with avatar_text", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    await tool.execute({ content: "欢迎", sender_name: "酒馆老板", avatar_text: "陈", role: "npc" })
    const msg = chatManager.getMessages("sess_1")[0]!
    expect(msg.senderRole).toBe("npc")
    expect(msg.senderName).toBe("酒馆老板")
    expect(msg.avatarText).toBe("陈")
  })

  test("calls onMessage callback", async () => {
    const received: Array<{ name: string; content: string }> = []
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent", (name, c) =>
      received.push({ name, content: c }),
    )
    await tool.execute({ content: "test", sender_name: "GM", role: "agent" })
    expect(received).toEqual([{ name: "GM", content: "test" }])
  })

  test("returns error for empty content", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "", sender_name: "GM", role: "agent" })
    expect(result.isError).toBe(true)
  })

  test("returns error for npc without avatar_text", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "hi", sender_name: "NPC", role: "npc" })
    expect(result.isError).toBe(true)
  })

  test("agent role does not require avatar_text", async () => {
    const tool = createMessageTool(chatManager, { id: "sess_1" }, "agent", "agent")
    const result = await tool.execute({ content: "叙事", sender_name: "GM", role: "agent" })
    expect(result.isError).toBeFalsy()
  })
})
