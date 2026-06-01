import { describe, test, expect } from "bun:test"
import { createNotifyTool, type NotifyTarget } from "../../src/tool/notify"

describe("createNotifyTool", () => {
  test("calls notifyFn with content and targets", async () => {
    const calls: Array<{ content: string; targets: NotifyTarget[] }> = []
    const tool = createNotifyTool(async (content, targets) => {
      calls.push({ content, targets })
    })

    const result = await tool.execute({
      content: "有人来了",
      targets: [{ session_id: "npc_1", expect_reply: true }],
    })

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain("npc_1")
    expect(result.content).toContain("reply")
    expect(calls).toHaveLength(1)
    expect(calls[0]!.content).toBe("有人来了")
    expect(calls[0]!.targets[0]!.session_id).toBe("npc_1")
    expect(calls[0]!.targets[0]!.expect_reply).toBe(true)
  })

  test("supports multiple targets", async () => {
    const calls: Array<{ content: string; targets: NotifyTarget[] }> = []
    const tool = createNotifyTool(async (content, targets) => {
      calls.push({ content, targets })
    })

    const result = await tool.execute({
      content: "大家好",
      targets: [{ session_id: "npc_1" }, { session_id: "npc_2", expect_reply: true }],
    })

    expect(result.isError).toBeFalsy()
    expect(calls[0]!.targets).toHaveLength(2)
    expect(result.content).toContain("npc_1")
    expect(result.content).toContain("npc_2")
  })

  test("returns error for empty content", async () => {
    const tool = createNotifyTool(async () => {})
    const result = await tool.execute({ content: "", targets: [{ session_id: "npc_1" }] })
    expect(result.isError).toBe(true)
  })

  test("returns error for empty targets", async () => {
    const tool = createNotifyTool(async () => {})
    const result = await tool.execute({ content: "hi", targets: [] })
    expect(result.isError).toBe(true)
  })
})
