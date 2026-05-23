import { describe, test, expect, mock, beforeEach } from "bun:test"
import { SubagentDispatcher } from "../../src/agent/subagent"
import { AgentRegistry, type AgentInfo } from "../../src/agent/registry"
import { OpenAIModel, type ChatResponse } from "../../src/model/openai"
import { ToolRegistry } from "../../src/tool/base"

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

  beforeEach(() => {
    agentRegistry = new AgentRegistry()
    agentRegistry.register({
      name: "explore",
      description: "Research agent",
      mode: "subagent",
      systemPrompt: "You are an explorer.",
    })
    toolRegistry = new ToolRegistry()
  })

  test("spawn returns result with sessionId", async () => {
    const model = createMockModel({
      content: "Exploration complete",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

    const result = await dispatcher.spawn("explore", "Find all TypeScript files")

    expect(result.content).toBe("Exploration complete")
    expect(result.sessionId).toMatch(/^subagent-\d+-\d+$/)
  })

  test("spawn with background=true returns immediately with empty content", async () => {
    const model = createMockModel({
      content: "Background work done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

    const result = await dispatcher.spawn("explore", "Do background work", { background: true })

    expect(result.content).toBe("")
    expect(result.sessionId).toMatch(/^subagent-\d+-\d+$/)
  })

  test("spawn throws error for unknown agent type", async () => {
    const model = createMockModel({
      content: "Should not reach here",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

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

    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

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
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

    await expect(dispatcher.send("nonexistent-session", "test")).rejects.toThrow("Session not found: nonexistent-session")
  })

  test("hasSession returns true for existing session", async () => {
    const model = createMockModel({
      content: "Done",
      toolCalls: null,
      finishReason: "stop",
    })
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

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
    const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)

    const result = await dispatcher.spawn("explore", "test", { background: true })

    expect(dispatcher.hasSession(result.sessionId)).toBe(true)
  })
})
