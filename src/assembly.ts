import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { loadBuiltinTools } from "./tool/builtin"
import { createSpawnSubagentTool } from "./tool/task"
import { AgentRegistry, loadAgents } from "./agent"
import { SubagentDispatcher } from "./agent/subagent"
import { AgentLoop } from "./agent/loop"

export interface App {
  model: OpenAIModel
  agentRegistry: AgentRegistry
  toolRegistry: ToolRegistry
  dispatcher: SubagentDispatcher
  primaryAgent: AgentLoop
  primaryPrompt: string
}

function loadConfig(): ModelConfig {
  const baseUrl = process.env.OPENAI_BASE_URL
  const apiKey = process.env.MIMO_API_KEY
  const model = process.env.MODEL_NAME ?? "mimo-v2.5-pro"

  if (!baseUrl) throw new Error("Missing OPENAI_BASE_URL environment variable")
  if (!apiKey) throw new Error("Missing MIMO_API_KEY environment variable")

  return { baseUrl, apiKey, model }
}

export function createApp(): App {
  const config = loadConfig()
  const model = new OpenAIModel(config)

  const agentRegistry = loadAgents()

  const primary = agentRegistry.getPrimary()
  if (!primary) throw new Error("No primary agent found")

  const toolRegistry = new ToolRegistry()
  for (const tool of loadBuiltinTools()) {
    toolRegistry.register(tool)
  }

  const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry)
  toolRegistry.register(createSpawnSubagentTool(dispatcher))

  const primaryAgent = new AgentLoop(model, toolRegistry, {
    systemPrompt: primary.systemPrompt,
  })

  return {
    model,
    agentRegistry,
    toolRegistry,
    dispatcher,
    primaryAgent,
    primaryPrompt: primary.systemPrompt ?? "",
  }
}
