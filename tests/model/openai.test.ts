import { describe, test, expect } from "bun:test"
import { OpenAIModel } from "../../src/model/openai"
import { createMockOpenAIServer, type RequestHandler } from "../helpers/mock-server"

function createModel(handler: RequestHandler) {
  const server = createMockOpenAIServer(handler)
  const model = new OpenAIModel({
    baseUrl: `${server.baseUrl}/v1`,
    apiKey: "test-key",
    model: "mock-model",
  })
  return { model, stop: server.stop }
}

describe("OpenAIModel", () => {
  test("receives plain text response", async () => {
    const { model, stop } = createModel(() => ({
      content: "Hello, world!",
    }))

    try {
      const response = await model.chat([{ role: "user", content: "Hi" }])

      expect(response.content).toBe("Hello, world!")
      expect(response.toolCalls).toBeNull()
      expect(response.finishReason).toBe("stop")
    } finally {
      stop()
    }
  })

  test("receives tool call response", async () => {
    const { model, stop } = createModel(() => ({
      content: null,
      toolCalls: [{ id: "call_abc", name: "get_current_time", arguments: { timezone_offset: 8 } }],
      finishReason: "tool_calls",
    }))

    try {
      const response = await model.chat(
        [{ role: "user", content: "What time is it?" }],
        [{ id: "get_current_time", description: "Get time", parameters: {}, execute: async () => ({ content: "" }) }],
      )

      expect(response.content).toBeNull()
      expect(response.toolCalls).toHaveLength(1)
      expect(response.toolCalls).not.toBeNull()
      const tc = response.toolCalls![0]!
      expect(tc.id).toBe("call_abc")
      expect(tc.name).toBe("get_current_time")
      expect(tc.arguments).toEqual({ timezone_offset: 8 })
      expect(response.finishReason).toBe("tool_calls")
    } finally {
      stop()
    }
  })

  test("multiple tool calls in one response", async () => {
    const { model, stop } = createModel(() => ({
      content: null,
      toolCalls: [
        { id: "call_1", name: "tool_a", arguments: { a: 1 } },
        { id: "call_2", name: "tool_b", arguments: { b: 2 } },
      ],
    }))

    try {
      const response = await model.chat(
        [{ role: "user", content: "Do two things" }],
        [
          { id: "tool_a", description: "A", parameters: {}, execute: async () => ({ content: "" }) },
          { id: "tool_b", description: "B", parameters: {}, execute: async () => ({ content: "" }) },
        ],
      )

      expect(response.toolCalls).toHaveLength(2)
      expect(response.toolCalls).not.toBeNull()
      expect(response.toolCalls![0]!.name).toBe("tool_a")
      expect(response.toolCalls![1]!.name).toBe("tool_b")
    } finally {
      stop()
    }
  })

  test("empty content returns null", async () => {
    const { model, stop } = createModel(() => ({
      content: "",
    }))

    try {
      const response = await model.chat([{ role: "user", content: "test" }])
      expect(response.content).toBeNull()
    } finally {
      stop()
    }
  })
})
