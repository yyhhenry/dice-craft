import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { loadBuiltinTools } from "./tool/builtin"
import { createSpawnSubagentTool } from "./tool/task"
import { createSkillTool } from "./tool/skill"
import { createMessageTool } from "./tool/message"
import { createNotifyTool } from "./tool/notify"
import { AgentRegistry, loadAgents } from "./agent"
import { SubagentDispatcher } from "./agent/subagent"
import { AgentLoop } from "./agent/loop"
import { SessionStore } from "./session/store"
import { SessionManager } from "./session/manager"
import { WorkspaceGuard } from "./workspace/guard"
import { ChatManager } from "./chat/manager"
import type { WorkspaceID } from "./workspace/types"

export interface App {
  model: OpenAIModel
  agentRegistry: AgentRegistry
  toolRegistry: ToolRegistry
  sessionManager: SessionManager
  chatManager: ChatManager
  dispatcher: SubagentDispatcher
  primaryAgent: AgentLoop
  workspacePath: string
  /** Mutable session ID reference — message tool closures capture this object */
  sessionRef: { id: string }
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
  primarySessionId?: string
  onMessage?: (senderName: string, content: string) => void
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
  const chatManager = new ChatManager(dataDir)

  const sessionRef = { id: options?.primarySessionId ?? "sess_primary" }
  const onMessage = options?.onMessage

  // Register primary agent identity
  chatManager.registerIdentity({ id: "agent", name: primary.name ?? "Agent", role: "agent" })

  // Create notify function using dispatcher
  const dispatcher = new SubagentDispatcher(
    model,
    toolRegistry,
    agentRegistry,
    sessionManager,
    workspaceId,
    // setupLoop: create per-NPC registry with message tool
    (ctx) => {
      chatManager.registerIdentity({
        id: ctx.sessionId,
        name: ctx.agentName,
        role: "npc",
      })
      const npcRegistry = new ToolRegistry()
      for (const tool of toolRegistry.all()) {
        npcRegistry.register(tool)
      }
      npcRegistry.register(
        createMessageTool(chatManager, sessionRef, ctx.sessionId, "npc", (name, _content) => {
          if (onMessage) onMessage(name, _content)
        }),
      )
      return npcRegistry
    },
  )

  // Register notify tool (depends on dispatcher)
  const notifyFn = async (
    content: string,
    targets: import("./tool/notify").NotifyTarget[],
  ) => {
    await dispatcher.notifyMultiple(targets, content)
  }
  toolRegistry.register(createNotifyTool(notifyFn))

  // Register spawn subagent tool
  toolRegistry.register(createSpawnSubagentTool(dispatcher))

  // Register skill tool if skillsDir is provided
  const skillsDir = options?.skillsDir
  if (skillsDir) {
    toolRegistry.register(createSkillTool(skillsDir))
  }

  // Register message tool for primary agent
  toolRegistry.register(
    createMessageTool(chatManager, sessionRef, "agent", "agent", (name, _content) => {
      if (onMessage) onMessage(name, _content)
    }),
  )

  const primaryAgent = new AgentLoop(model, toolRegistry, {
    systemPrompt: primary.systemPrompt,
    onResponse: (response) => {
      if (onMessage) onMessage(primary.name ?? "Agent", response)
    },
  })

  return {
    model,
    agentRegistry,
    toolRegistry,
    sessionManager,
    chatManager,
    dispatcher,
    primaryAgent,
    workspacePath,
    sessionRef,
  }
}
