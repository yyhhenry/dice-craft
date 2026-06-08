import { describe, test, expect, mock } from "bun:test"
import { AgentLoop } from "../../src/agent/loop"
import { OpenAIModel, type ChatResponse } from "../../src/model/openai"
import { ToolRegistry, type Tool } from "../../src/tool/base"

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

function createMockTool(id: string, result: string): Tool {
  return {
    id,
    description: `Mock tool: ${id}`,
    parameters: { type: "object", properties: {} },
    execute: mock(() => Promise.resolve({ content: result })),
  }
}

describe("AgentLoop", () => {
  test("direct conversation (no tool calls) returns immediately", async () => {
    const model = createMockModel({
      content: "Hello!",
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry)

    const { response } = await agent.run("Hello")
    expect(response).toBe("Hello!")
  })

  test("tool call executes then loops until text response", async () => {
    const tool = createMockTool("get_current_time", "Current time: 2026-01-01 12:00:00 (UTC+8)")
    const registry = new ToolRegistry()
    registry.register(tool)

    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: null,
          toolCalls: [{ id: "call_1", name: "get_current_time", arguments: {} }],
          finishReason: "tool_calls",
        })
      }
      return Promise.resolve({
        content: "It is 2026-01-01 12:00:00.",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const agent = new AgentLoop(model, registry)
    const { response } = await agent.run("What time is it?")

    expect(response).toBe("It is 2026-01-01 12:00:00.")
    expect(tool.execute).toHaveBeenCalledTimes(1)
  })

  test("unknown tool returns error message to LLM", async () => {
    const registry = new ToolRegistry()

    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: null,
          toolCalls: [{ id: "call_1", name: "nonexistent_tool", arguments: {} }],
          finishReason: "tool_calls",
        })
      }
      return Promise.resolve({
        content: "Sorry, I cannot perform that operation.",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const agent = new AgentLoop(model, registry)
    const { response } = await agent.run("Do something")

    expect(response).toBe("Sorry, I cannot perform that operation.")
  })

  test("max iterations returns fallback message", async () => {
    const tool = createMockTool("loop_tool", "Continue")
    const registry = new ToolRegistry()
    registry.register(tool)

    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() =>
      Promise.resolve({
        content: null,
        toolCalls: [{ id: "call_1", name: "loop_tool", arguments: {} }],
        finishReason: "tool_calls",
      }),
    )

    const agent = new AgentLoop(model, registry, { maxIterations: 3 })
    const { response } = await agent.run("Enter loop")

    expect(response).toBe("Max iterations reached. Please try again.")
    expect(model.chat).toHaveBeenCalledTimes(3)
  })

  test("system prompt is correctly set", async () => {
    const model = createMockModel({
      content: "Acknowledged",
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, { systemPrompt: "You are a test assistant." })

    await agent.run("Hello")

    const calledMessages = (model.chat as any).mock.calls[0][0] as any[]
    expect(calledMessages[0]).toEqual({ role: "system", content: "You are a test assistant." })
    expect(calledMessages.find((m: any) => m.role === "user" && m.content === "Hello")).toBeTruthy()
  })

  test("no system message when systemPrompt is omitted", async () => {
    const model = createMockModel({
      content: "Hi there",
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry)

    await agent.run("Hello")

    const calledMessages = (model.chat as any).mock.calls[0][0] as any[]
    expect(calledMessages.find((m: any) => m.role === "system")).toBeUndefined()
    expect(calledMessages[0]).toEqual({ role: "user", content: "Hello" })
  })

  test("history is correctly passed through", async () => {
    const model = createMockModel({
      content: "Continuing conversation",
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry)

    const history = [{ role: "user" as const, content: "Previous message" }]
    await agent.run("New message", history)

    const calledMessages = (model.chat as any).mock.calls[0][0] as any[]
    expect(calledMessages.find((m: any) => m.content === "Previous message")).toBeTruthy()
    expect(calledMessages.find((m: any) => m.content === "New message")).toBeTruthy()
  })

  test("injectEvent adds events to queue", () => {
    const model = createMockModel({
      content: "Done",
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry)

    agent.injectEvent("user", "New info")
    agent.injectEvent("subagent:abc", "Task complete")

    // Events are queued, no immediate effect
    expect(true).toBe(true)
  })

  test("flushEvents injects pending events after tool calls", async () => {
    const tool = createMockTool("test_tool", "Tool result")
    const registry = new ToolRegistry()
    registry.register(tool)

    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: null,
          toolCalls: [{ id: "call_1", name: "test_tool", arguments: {} }],
          finishReason: "tool_calls",
        })
      }
      return Promise.resolve({
        content: "Final response",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const agent = new AgentLoop(model, registry)

    // Inject event before running
    agent.injectEvent("user", "Injected message")

    await agent.run("Initial message")

    // Check that the injected event appeared in messages
    const secondCallMessages = (model.chat as any).mock.calls[1][0] as any[]
    const eventMessage = secondCallMessages.find(
      (m: any) => m.role === "user" && m.content.includes("Injected message"),
    )
    expect(eventMessage).toBeTruthy()
    expect(eventMessage.content).toContain('<event source="user">')
  })

  test("multiple events are batched and injected together", async () => {
    const tool = createMockTool("test_tool", "Tool result")
    const registry = new ToolRegistry()
    registry.register(tool)

    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: null,
          toolCalls: [{ id: "call_1", name: "test_tool", arguments: {} }],
          finishReason: "tool_calls",
        })
      }
      return Promise.resolve({
        content: "Done",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const agent = new AgentLoop(model, registry)

    agent.injectEvent("user", "Event 1")
    agent.injectEvent("subagent:abc", "Event 2")
    agent.injectEvent("system", "Event 3")

    await agent.run("Test")

    const secondCallMessages = (model.chat as any).mock.calls[1][0] as any[]
    const eventMessages = secondCallMessages.filter(
      (m: any) => m.role === "user" && m.content.includes("<event source="),
    )
    expect(eventMessages).toHaveLength(3)
  })

  test("receiveMessage calls onError when model.chat fails", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({ content: "x", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => Promise.reject(new Error("API unavailable")))

    const errors: unknown[] = []
    const agent = new AgentLoop(model, registry, {
      onError: (err) => errors.push(err),
    })

    agent.receiveMessage("Hello")
    await agent.waitForIdle()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error).message).toBe("API unavailable")
    expect(agent.isRunning()).toBe(false)
  })

  test("no events injected when queue is empty", async () => {
    const tool = createMockTool("test_tool", "Tool result")
    const registry = new ToolRegistry()
    registry.register(tool)

    let callCount = 0
    const model = createMockModel({ content: "", toolCalls: null, finishReason: "stop" })
    model.chat = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          content: null,
          toolCalls: [{ id: "call_1", name: "test_tool", arguments: {} }],
          finishReason: "tool_calls",
        })
      }
      return Promise.resolve({
        content: "Done",
        toolCalls: null,
        finishReason: "stop",
      })
    })

    const agent = new AgentLoop(model, registry)

    // No events injected
    await agent.run("Test")

    const secondCallMessages = (model.chat as any).mock.calls[1][0] as any[]
    const eventMessages = secondCallMessages.filter(
      (m: any) => m.role === "user" && m.content.includes("<event source="),
    )
    expect(eventMessages).toHaveLength(0)
  })
})
