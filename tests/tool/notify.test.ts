import { describe, test, expect } from "bun:test"
import { createNotifyTool, type NotifyTarget } from "../../src/tool/notify"

describe("createNotifyTool", () => {
  test("calls notifyFn and returns NPC responses", async () => {
    const calls: Array<{ content: string; targets: NotifyTarget[] }> = []
    const tool = createNotifyTool(async (content, targets) => {
      calls.push({ content, targets })
      return targets.map((t) => ({ sessionId: t.session_id, response: `Hello from ${t.session_id}` }))
    })

    const result = await tool.execute({
      content: "有人来了",
      targets: [{ session_id: "npc_1" }],
    })

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain("npc_response")
    expect(result.content).toContain("npc_1")
    expect(result.content).toContain("Hello from npc_1")
    expect(calls).toHaveLength(1)
    expect(calls[0]!.content).toBe("有人来了")
  })

  test("supports multiple targets in parallel", async () => {
    const tool = createNotifyTool(async (_content, targets) => {
      return targets.map((t) => ({ sessionId: t.session_id, response: `Response from ${t.session_id}` }))
    })

    const result = await tool.execute({
      content: "大家好",
      targets: [{ session_id: "npc_1" }, { session_id: "npc_2" }],
    })

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain("npc_1")
    expect(result.content).toContain("npc_2")
    expect(result.content).toContain("Response from npc_1")
    expect(result.content).toContain("Response from npc_2")
  })

  test("returns error for empty content", async () => {
    const tool = createNotifyTool(async () => [])
    const result = await tool.execute({ content: "", targets: [{ session_id: "npc_1" }] })
    expect(result.isError).toBe(true)
  })

  test("returns error for empty targets", async () => {
    const tool = createNotifyTool(async () => [])
    const result = await tool.execute({ content: "hi", targets: [] })
    expect(result.isError).toBe(true)
  })
})
