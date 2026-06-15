import { describe, test, expect, mock } from "bun:test"
import { AgentLoop, TokenEstimator } from "../../src/agent/loop"
import { OpenAIModel, type ChatResponse } from "../../src/model/openai"
import { ToolRegistry } from "../../src/tool/base"

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

describe("TokenEstimator", () => {
  test("estimates tokens as bytes/4", () => {
    const estimator = new TokenEstimator()
    const messages = [{ role: "user" as const, content: "hello" }]
    const tokens = estimator.update(messages)
    const expectedBytes = new TextEncoder().encode(JSON.stringify(messages[0])).length
    expect(tokens).toBe(Math.ceil(expectedBytes / 4))
  })

  test("incremental update only processes new messages", () => {
    const estimator = new TokenEstimator()
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "second" },
    ]

    const t1 = estimator.update(messages.slice(0, 1))
    const t2 = estimator.update(messages)

    const bytes1 = new TextEncoder().encode(JSON.stringify(messages[0])).length
    const bytes2 = new TextEncoder().encode(JSON.stringify(messages[1])).length
    expect(t1).toBe(Math.ceil(bytes1 / 4))
    expect(t2).toBe(Math.ceil((bytes1 + bytes2) / 4))
  })

  test("reset clears accumulated state", () => {
    const estimator = new TokenEstimator()
    estimator.update([{ role: "user" as const, content: "hello" }])
    expect(estimator.tokens).toBeGreaterThan(0)

    estimator.reset()
    expect(estimator.tokens).toBe(0)
  })

  test("Chinese text produces more bytes than chars", () => {
    const estimator = new TokenEstimator()
    const msg = { role: "user" as const, content: "你好世界这是中文测试" }
    estimator.update([msg])
    const charBased = Math.ceil(JSON.stringify(msg).length / 4)
    expect(estimator.tokens).toBeGreaterThan(charBased)
  })
})

describe("AgentLoop compaction", () => {
  test("does not compact when below threshold", async () => {
    const model = createMockModel({
      content: "Response",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 100_000,
    })

    await agent.run("Hello")

    const calledMessages = (model.chat as any).mock.calls[0][0] as any[]
    expect(calledMessages.find((m: any) => m.content?.includes("Compacted conversation context"))).toBeUndefined()
  })

  test("compacts when API reports prompt_tokens above threshold", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({
      content: "First response",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })

    model.chat = mock((messages: any[]) => {
      // First call: the compaction summarize call
      if (messages[0]?.content?.includes("summarization assistant")) {
        return Promise.resolve({
          content: "## 当前目标\n- Test goal\n\n## 游戏规则与约束\n- (none)",
          reasoningContent: null,
          toolCalls: null,
          finishReason: "stop",
          usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        })
      }
      // Second call: the actual conversation
      return Promise.resolve({
        content: "Compacted response",
        reasoningContent: null,
        toolCalls: null,
        finishReason: "stop",
        usage: { promptTokens: 500, completionTokens: 50, totalTokens: 550 },
      })
    })

    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 2,
    })

    // Set up history with enough content and simulate high usage
    const history = [
      { role: "user" as const, content: "old message 1 ".repeat(50) },
      { role: "assistant" as const, content: "old response 1 ".repeat(50) },
      { role: "user" as const, content: "old message 2 ".repeat(50) },
      { role: "assistant" as const, content: "old response 2 ".repeat(50) },
      { role: "user" as const, content: "recent message 1" },
      { role: "assistant" as const, content: "recent response 1" },
      { role: "user" as const, content: "recent message 2" },
      { role: "assistant" as const, content: "recent response 2" },
    ]
    agent.setHistory(history)

    // Simulate that API reported high token usage on last call
    ;(agent as any).lastPromptTokens = 900

    const { response } = await agent.run("new question")
    expect(response).toBe("Compacted response")

    // The model should have been called for summarization first
    const summarizeCall = (model.chat as any).mock.calls[0][0] as any[]
    expect(summarizeCall[0].content).toContain("summarization assistant")
  })

  test("preserves raw history after compaction", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({
      content: "",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })
    model.chat = mock((messages: any[]) => {
      if (messages[0]?.content?.includes("summarization assistant")) {
        return Promise.resolve({
          content: "Summary of old context.",
          reasoningContent: null,
          toolCalls: null,
          finishReason: "stop",
          usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        })
      }
      return Promise.resolve({
        content: "Done",
        reasoningContent: null,
        toolCalls: null,
        finishReason: "stop",
        usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
      })
    })

    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 2,
    })

    const history = [
      { role: "user" as const, content: "old content ".repeat(100) },
      { role: "assistant" as const, content: "old reply ".repeat(100) },
      { role: "user" as const, content: "recent question" },
      { role: "assistant" as const, content: "recent answer" },
    ]
    agent.setHistory(history)
    ;(agent as any).lastPromptTokens = 900

    await agent.run("current question")

    const saved = agent.getHistory()
    // Raw history should contain all original messages + new ones
    expect(saved.some((m) => typeof m.content === "string" && m.content.includes("old content"))).toBe(true)
    expect(saved.some((m) => m.content === "current question")).toBe(true)
    expect(saved.some((m) => m.content === "Done")).toBe(true)
  })

  test("model receives summary + recent messages when compacting", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({
      content: "",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })

    let conversationMessages: any[] = []
    model.chat = mock((messages: any[]) => {
      if (messages[0]?.content?.includes("summarization assistant")) {
        return Promise.resolve({
          content: "Summarized context here.",
          reasoningContent: null,
          toolCalls: null,
          finishReason: "stop",
        })
      }
      conversationMessages = messages
      return Promise.resolve({
        content: "Final",
        reasoningContent: null,
        toolCalls: null,
        finishReason: "stop",
        usage: { promptTokens: 300, completionTokens: 50, totalTokens: 350 },
      })
    })

    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 2,
      systemPrompt: "You are a GM.",
    })

    const history = [
      { role: "user" as const, content: "old message ".repeat(100) },
      { role: "assistant" as const, content: "old reply ".repeat(100) },
      { role: "user" as const, content: "recent msg" },
      { role: "assistant" as const, content: "recent reply" },
    ]
    agent.setHistory(history)
    ;(agent as any).lastPromptTokens = 900

    await agent.run("new question")

    // conversationMessages should have: system(GM) + system(summary) + recent messages + new user msg
    expect(conversationMessages[0]).toEqual({ role: "system", content: "You are a GM." })
    expect(conversationMessages[1].content).toContain("Compacted conversation context")
    expect(conversationMessages[1].content).toContain("Summarized context here.")
    // Should include recent messages
    expect(conversationMessages.some((m: any) => m.content === "recent msg")).toBe(true)
    expect(conversationMessages.some((m: any) => m.content === "new question")).toBe(true)
    // Should NOT include old messages
    expect(
      conversationMessages.some((m: any) => typeof m.content === "string" && m.content.includes("old message")),
    ).toBe(false)
  })

  test("fallback when summarization fails", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({
      content: "",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })
    model.chat = mock((messages: any[]) => {
      if (messages[0]?.content?.includes("summarization assistant")) {
        return Promise.reject(new Error("API error"))
      }
      return Promise.resolve({
        content: "Still works",
        reasoningContent: null,
        toolCalls: null,
        finishReason: "stop",
        usage: { promptTokens: 900, completionTokens: 50, totalTokens: 950 },
      })
    })

    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 2,
    })

    const history = [
      { role: "user" as const, content: "old ".repeat(200) },
      { role: "assistant" as const, content: "old reply ".repeat(200) },
      { role: "user" as const, content: "recent" },
      { role: "assistant" as const, content: "recent reply" },
    ]
    agent.setHistory(history)
    ;(agent as any).lastPromptTokens = 900

    const { response } = await agent.run("question")
    // Should still work — falls back to no compaction
    expect(response).toBe("Still works")
  })

  test("previous summary is passed to subsequent compaction", async () => {
    const registry = new ToolRegistry()
    const model = createMockModel({
      content: "",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })

    const summarizePrompts: string[] = []
    model.chat = mock((messages: any[]) => {
      if (messages[0]?.content?.includes("summarization assistant")) {
        const userPrompt = messages[1]?.content || ""
        summarizePrompts.push(userPrompt)
        return Promise.resolve({
          content: `Summary round ${summarizePrompts.length}`,
          reasoningContent: null,
          toolCalls: null,
          finishReason: "stop",
        })
      }
      return Promise.resolve({
        content: "ok",
        reasoningContent: null,
        toolCalls: null,
        finishReason: "stop",
        usage: { promptTokens: 900, completionTokens: 50, totalTokens: 950 },
      })
    })

    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 2,
    })

    // First round: triggers compaction
    const history = [
      { role: "user" as const, content: "msg1 ".repeat(100) },
      { role: "assistant" as const, content: "reply1 ".repeat(100) },
      { role: "user" as const, content: "msg2" },
      { role: "assistant" as const, content: "reply2" },
    ]
    agent.setHistory(history)
    ;(agent as any).lastPromptTokens = 900

    await agent.run("q1")

    // First summary should NOT contain previous-summary
    expect(summarizePrompts[0]).not.toContain("<previous-summary>")

    // Add more history and trigger compaction again
    const newHistory = agent.getHistory()
    newHistory.push(
      { role: "user" as const, content: "extra msg ".repeat(100) },
      { role: "assistant" as const, content: "extra reply ".repeat(100) },
    )
    agent.setHistory(newHistory)
    ;(agent as any).lastPromptTokens = 900
    ;(agent as any).compactState = { summary: "Summary round 1", compactedUpTo: 2 }

    await agent.run("q2")

    // Second summary SHOULD contain previous-summary
    expect(summarizePrompts[1]).toContain("<previous-summary>")
    expect(summarizePrompts[1]).toContain("Summary round 1")
  })

  test("getContextUsage reports correct values", async () => {
    const model = createMockModel({
      content: "Hi",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
      usage: { promptTokens: 500, completionTokens: 50, totalTokens: 550 },
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
    })

    await agent.run("Hello")

    const usage = agent.getContextUsage()
    expect(usage.tokens).toBe(500)
    expect(usage.thresholdTokens).toBe(800) // 1000 * 0.8
    expect(usage.percent).toBe(63) // 500/800 * 100 = 62.5 → 63
    expect(usage.compacted).toBe(false)
    expect(usage.compactedMessageCount).toBe(0)
  })

  test("getContextUsage uses estimator when no API usage available", () => {
    const model = createMockModel({
      content: "Hi",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 100_000,
    })

    agent.setHistory([
      { role: "user" as const, content: "hello world" },
      { role: "assistant" as const, content: "hi there" },
    ])

    const usage = agent.getContextUsage()
    expect(usage.tokens).toBeGreaterThan(0)
    expect(usage.compacted).toBe(false)
  })

  test("compaction disabled when contextWindowTokens is 0", async () => {
    const model = createMockModel({
      content: "Response",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
      usage: { promptTokens: 999999, completionTokens: 50, totalTokens: 1000049 },
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 0,
    })

    // Even with huge token usage, should not trigger compaction
    agent.setHistory([
      { role: "user" as const, content: "a".repeat(10000) },
      { role: "assistant" as const, content: "b".repeat(10000) },
      { role: "user" as const, content: "c" },
      { role: "assistant" as const, content: "d" },
    ])

    await agent.run("Hello")

    // Only one call (the conversation itself, no summarize call)
    expect(model.chat).toHaveBeenCalledTimes(1)
  })

  test("does not compact when too few messages for split", async () => {
    const model = createMockModel({
      content: "Response",
      reasoningContent: null,
      toolCalls: null,
      finishReason: "stop",
      usage: { promptTokens: 900, completionTokens: 50, totalTokens: 950 },
    })
    const registry = new ToolRegistry()
    const agent = new AgentLoop(model, registry, {
      contextWindowTokens: 1000,
      recentTurnsToKeep: 4,
    })

    // Only 2 user turns — less than recentTurnsToKeep
    agent.setHistory([
      { role: "user" as const, content: "msg1" },
      { role: "assistant" as const, content: "reply1" },
    ])
    ;(agent as any).lastPromptTokens = 900

    await agent.run("msg2")

    // Should not attempt summarization since split returns null
    expect(model.chat).toHaveBeenCalledTimes(1)
  })
})
