import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import { createSpawnSubagentTool } from "../../src/tool/task"
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

describe("SpawnSubagentTool", () => {
  let dispatcher: SubagentDispatcher
  let agentRegistry: AgentRegistry
  let toolRegistry: ToolRegistry
  let sessionManager: ReturnType<typeof createTestSessionManager>
  const sessionRef = { id: "sess_test" }

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
    dispatcher = new SubagentDispatcher(
      createMockModel({ content: "Done", toolCalls: null, finishReason: "stop" }),
      toolRegistry,
      agentRegistry,
      sessionManager.sessionManager,
      sessionManager.workspaceId
    )
  })

  afterEach(() => {
    sessionManager.cleanup()
  })

  test("tool has correct id and description", () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)
    expect(tool.id).toBe("spawn_subagent")
    expect(tool.description).toBeTruthy()
  })

  test("tool parameters include required fields", () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)
    expect(tool.parameters.required).toContain("agent_type")
    expect(tool.parameters.required).toContain("prompt")
  })

  test("execute spawns subagent and returns result", async () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)

    const result = await tool.execute({
      agent_type: "explore",
      prompt: "Find all TypeScript files",
    })

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain("Done")
  })

  test("execute returns error for unknown agent type", async () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)

    const result = await tool.execute({
      agent_type: "nonexistent",
      prompt: "test",
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain("Unknown agent type")
  })

  test("execute with background=true returns sessionId", async () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)

    const result = await tool.execute({
      agent_type: "explore",
      prompt: "Background task",
      background: true,
    })

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain("Subagent spawned in background")
  })

  test("execute uses default values for optional parameters", async () => {
    const tool = createSpawnSubagentTool(dispatcher, sessionRef)

    const result = await tool.execute({
      agent_type: "explore",
      prompt: "test",
    })

    expect(result.isError).toBeFalsy()
  })
})
