import path from "path"
import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { loadBuiltinTools } from "./tool/builtin"
import { createSpawnSubagentTool } from "./tool/task"
import { createDismissNpcTool } from "./tool/dismiss-npc"
import { createSkillTool, discoverSkills, fmtSkills } from "./tool/skill"
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
  sessionRef: { id: string }
}

export function createApp(options: {
  dataDir?: string
  workspaceId?: WorkspaceID
  workspacePath?: string
  skillsDir?: string
  primarySessionId?: string
  modelConfig: ModelConfig
  onMessage?: (senderName: string, content: string) => void
}): App {
  const model = new OpenAIModel(options.modelConfig)

  const agentRegistry = loadAgents()

  const primary = agentRegistry.getPrimary()
  if (!primary) throw new Error("No primary agent found")

  const workspacePath = options.workspacePath ?? process.cwd()
  const guard = new WorkspaceGuard(workspacePath)

  const toolRegistry = new ToolRegistry()
  for (const tool of loadBuiltinTools(guard)) {
    toolRegistry.register(tool)
  }

  const dataDir = options.dataDir ?? "data"
  const workspaceId = (options.workspaceId ?? "ws_default") as WorkspaceID
  const sessionStore = new SessionStore(dataDir)
  const sessionManager = new SessionManager(sessionStore)
  const chatManager = new ChatManager(dataDir)

  const sessionRef = { id: options.primarySessionId ?? "sess_primary" }
  const onMessage = options.onMessage

  const dispatcher = new SubagentDispatcher(
    model,
    toolRegistry,
    agentRegistry,
    sessionManager,
    workspaceId,
    (ctx) => {
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

  const notifyFn = async (
    content: string,
    targets: import("./tool/notify").NotifyTarget[],
  ) => {
    await dispatcher.notifyMultiple(targets, content)
  }
  toolRegistry.register(createNotifyTool(notifyFn))

  toolRegistry.register(createSpawnSubagentTool(dispatcher, sessionRef))
  toolRegistry.register(createDismissNpcTool(dispatcher))

  dispatcher.onSubagentDone = (sessionId, agentName, content) => {
    primaryAgent.injectEvent(
      "subagent_done",
      `<subagent type="${agentName}" session="${sessionId}">\n${content}\n</subagent>`,
    )
  }

  const skillsDir = options.skillsDir
  if (skillsDir) {
    toolRegistry.register(createSkillTool(skillsDir))
  }

  toolRegistry.register(
    createMessageTool(chatManager, sessionRef, "agent", "agent", (name, _content) => {
      if (onMessage) onMessage(name, _content)
    }),
  )

  const skills = discoverSkills(skillsDir ?? path.join(workspacePath, "skills"))
  const skillsSection = fmtSkills(skills, false)
  const systemPrompt = [primary.systemPrompt, "", skillsSection].join("\n")

  const primaryAgent = new AgentLoop(model, toolRegistry, {
    systemPrompt,
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
