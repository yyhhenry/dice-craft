import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import { SubagentDispatcher } from "../../src/agent/subagent"
import { AgentRegistry } from "../../src/agent/registry"
import { OpenAIModel, type ChatResponse } from "../../src/model/openai"
import { ToolRegistry } from "../../src/tool/base"
import { createTestSessionManager } from "../helpers/session"

function createMockModel(response: ChatResponse): OpenAIModel {
  const config = {
    baseUrl: "https://test.example.com",
    apiKey: "test",
    model: "test",
  }
  const model = new OpenAIModel(config)
  model.chat = mock(() => Promise.resolve(response))
  return model
}

describe("SubagentDispatcher", () => {
  let agentRegistry: AgentRegistry
  let toolRegistry: ToolRegistry
  let sessionManager: ReturnType<typeof createTestSessionManager>

  beforeEach(() => {
    agentRegistry = new AgentRegistry()
    agentRegistry.register({
      name: "explore",
      description: "Research agent",
      mode: "subagent",
      systemPrompt: "You are an explorer.",
    })
    toolRegistry = new ToolRegistry()
    sessionManager = createTestSessionManager()
  })

  afterEach(() => {
    sessionManager.cleanup()
  })

  test("spawn returns sessionId", async () => {
    const model = createMockModel({
      content: "Exploration complete",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "Find all TypeScript files")

    expect(result.sessionId).toMatch(/^sess_/)
  })

  test("spawn with background=true returns immediately", async () => {
    const model = createMockModel({
      content: "Background work done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "Do background work", { background: true })

    expect(result.sessionId).toMatch(/^sess_/)
  })

  test("spawn throws error for unknown agent type", async () => {
    const model = createMockModel({
      content: "Should not reach here",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    await expect(dispatcher.spawn("nonexistent", "test")).rejects.toThrow("Unknown agent type: nonexistent")
  })

  test("send continues conversation in existing session", async () => {
    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: "First response",
          toolCalls: null,
          finishReason: "stop",
        })
      }
      return Promise.resolve({
        content: "Second response",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const first = await dispatcher.spawn("explore", "First message", { background: true })
    await new Promise((r) => setTimeout(r, 10))
    await dispatcher.send(first.sessionId, "Second message", true)

    expect(callCount).toBe(2)
  })

  test("send throws error for nonexistent session", async () => {
    const model = createMockModel({
      content: "Should not reach here",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    expect(() => dispatcher.send("nonexistent-session", "test", false)).toThrow(
      "Session not found: nonexistent-session",
    )
  })

  test("hasSession returns false for foreground session after completion", async () => {
    const model = createMockModel({
      content: "Done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "test")

    expect(dispatcher.hasSession(result.sessionId)).toBe(false)
    expect(dispatcher.hasSession("nonexistent")).toBe(false)
  })

  test("hasSession returns true for background session", async () => {
    const model = createMockModel({
      content: "Background done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "test", { background: true })

    expect(dispatcher.hasSession(result.sessionId)).toBe(true)
  })

  test("spawn persists session to disk", async () => {
    const model = createMockModel({
      content: "Persisted",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "test prompt")

    const stored = sessionManager.sessionManager.get(result.sessionId)
    expect(stored).toBeDefined()
    expect(stored?.agentType).toBe("explore")
    expect(stored?.title).toBe("test prompt")
  })

  test("restore loads session from disk into memory", async () => {
    const model = createMockModel({
      content: "Restored",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const result = await dispatcher.spawn("explore", "original prompt")
    const sessionId = result.sessionId

    const dispatcher2 = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    expect(dispatcher2.hasSession(sessionId)).toBe(false)
    dispatcher2.restore(sessionId)
    expect(dispatcher2.hasSession(sessionId)).toBe(true)
  })

  test("notifyMultiple sends to multiple targets", async () => {
    const model = createMockModel({ content: "ok", toolCalls: null, finishReason: "stop" })
    const dispatcher = new SubagentDispatcher(
      model,
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId,
    )

    const r1 = await dispatcher.spawn("explore", "task 1", { background: true })
    const r2 = await dispatcher.spawn("explore", "task 2", { background: true })
    await new Promise((r) => setTimeout(r, 10))

    await dispatcher.notifyMultiple(
      [{ session_id: r1.sessionId }, { session_id: r2.sessionId, expect_reply: true }],
      "notification content",
    )
  })
})
