import { describe, test, expect, mock } from "bun:test"
import { AgentLoop } from "../../src/agent/loop"
import { OpenAIModel, type ChatResponse } from "../../src/model/openai"
import { ToolRegistry, type Tool } from "../../src/tool/base"

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
      })
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
})
