import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { loadBuiltinTools } from "./tool/builtin"
import { createSpawnSubagentTool } from "./tool/task"
import { createSkillTool, discoverSkills, fmtSkills } from "./tool/skill"
import { AgentRegistry, loadAgents } from "./agent"
import { SubagentDispatcher } from "./agent/subagent"
import { AgentLoop } from "./agent/loop"
import { SessionStore } from "./session/store"
import { SessionManager } from "./session/manager"
import { WorkspaceGuard } from "./workspace/guard"
import type { WorkspaceID } from "./workspace/types"

export interface App {
  model: OpenAIModel
  agentRegistry: AgentRegistry
  toolRegistry: ToolRegistry
  sessionManager: SessionManager
  dispatcher: SubagentDispatcher
  primaryAgent: AgentLoop
  primaryPrompt: string
  workspacePath: string
}

function loadConfig(): ModelConfig {
  const baseUrl = process.env.OPENAI_BASE_URL
  const apiKey = process.env.MIMO_API_KEY
  const model = process.env.MODEL_NAME ?? "mimo-v2.5-pro"

  if (!baseUrl) throw new Error("Missing OPENAI_BASE_URL environment variable")
  if (!apiKey) throw new Error("Missing MIMO_API_KEY environment variable")

  return { baseUrl, apiKey, model }
}

export function createApp(options?: {
  dataDir?: string
  workspaceId?: WorkspaceID
  workspacePath?: string
  skillsDir?: string
}): App {
  const config = loadConfig()
  const model = new OpenAIModel(config)

  const agentRegistry = loadAgents()

  const primary = agentRegistry.getPrimary()
  if (!primary) throw new Error("No primary agent found")

  const workspacePath = options?.workspacePath ?? process.cwd()
  const guard = new WorkspaceGuard(workspacePath)

  const toolRegistry = new ToolRegistry()
  for (const tool of loadBuiltinTools(guard)) {
    toolRegistry.register(tool)
  }

  const dataDir = options?.dataDir ?? "data"
  const workspaceId = (options?.workspaceId ?? "ws_cli") as WorkspaceID
  const sessionStore = new SessionStore(dataDir)
  const sessionManager = new SessionManager(sessionStore)

  const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry, sessionManager, workspaceId)
  toolRegistry.register(createSpawnSubagentTool(dispatcher))

  // Register skill tool if skillsDir is provided
  const skillsDir = options?.skillsDir
  if (skillsDir) {
    toolRegistry.register(createSkillTool(skillsDir))
  }

  // Build available skills section for system prompt
  const skillsSection = skillsDir ? fmtSkills(discoverSkills(skillsDir), true) : ""

  const fullPrompt = [primary.systemPrompt ?? "", skillsSection].filter(Boolean).join("\n\n")

  const primaryAgent = new AgentLoop(model, toolRegistry, {
    systemPrompt: fullPrompt,
  })

  return {
    model,
    agentRegistry,
    toolRegistry,
    sessionManager,
    dispatcher,
    primaryAgent,
    primaryPrompt: fullPrompt,
    workspacePath,
  }
}
