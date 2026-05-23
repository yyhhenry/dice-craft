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
    maxTokens: 1024,
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

  test("spawn returns result with sessionId", async () => {
    const model = createMockModel({
      content: "Exploration complete",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const result = await dispatcher.spawn("explore", "Find all TypeScript files")

    expect(result.content).toBe("Exploration complete")
    expect(result.sessionId).toMatch(/^sess_/)
  })

  test("spawn with background=true returns immediately with empty content", async () => {
    const model = createMockModel({
      content: "Background work done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const result = await dispatcher.spawn("explore", "Do background work", { background: true })

    expect(result.content).toBe("")
    expect(result.sessionId).toMatch(/^sess_/)
  })

  test("spawn throws error for unknown agent type", async () => {
    const model = createMockModel({
      content: "Should not reach here",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
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
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const first = await dispatcher.spawn("explore", "First message")
    expect(first.content).toBe("First response")

    const second = await dispatcher.send(first.sessionId, "Second message")
    expect(second.content).toBe("Second response")
    expect(second.sessionId).toBe(first.sessionId)
  })

  test("send throws error for nonexistent session", async () => {
    const model = createMockModel({
      content: "Should not reach here",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    await expect(dispatcher.send("nonexistent-session", "test")).rejects.toThrow("Session not found: nonexistent-session")
  })

  test("hasSession returns true for existing session", async () => {
    const model = createMockModel({
      content: "Done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const result = await dispatcher.spawn("explore", "test")

    expect(dispatcher.hasSession(result.sessionId)).toBe(true)
    expect(dispatcher.hasSession("nonexistent")).toBe(false)
  })

  test("hasSession returns true for background session", async () => {
    const model = createMockModel({
      content: "Background done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
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
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const result = await dispatcher.spawn("explore", "test prompt")

    // Verify session was persisted
    const stored = sessionManager.sessionManager.get(result.sessionId)
    expect(stored).toBeDefined()
    expect(stored?.agentType).toBe("explore")
    expect(stored?.title).toBe("test prompt")

    // Verify messages were persisted
    const messages = sessionManager.sessionManager.getMessages(result.sessionId)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0]?.role).toBe("user")
    expect(messages[0]?.content).toBe("test prompt")
  })

  test("restore loads session from disk into memory", async () => {
    const model = createMockModel({
      content: "Restored",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    const result = await dispatcher.spawn("explore", "original prompt")
    const sessionId = result.sessionId

    // Create a new dispatcher (simulating restart) with same session manager
    const dispatcher2 = new SubagentDispatcher(
      model, toolRegistry, agentRegistry,
      sessionManager.sessionManager, sessionManager.workspaceId
    )

    // Before restore, session not in memory
    expect(dispatcher2.hasSession(sessionId)).toBe(false)

    // Restore
    dispatcher2.restore(sessionId)

    // After restore, session is in memory
    expect(dispatcher2.hasSession(sessionId)).toBe(true)

    // Can continue conversation
    const followUp = await dispatcher2.send(sessionId, "follow up")
    expect(followUp.content).toBe("Restored")
    expect(followUp.sessionId).toBe(sessionId)
  })
})
