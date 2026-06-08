import path from "path"
import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { loadBuiltinTools } from "./tool/builtin"
import { createSpawnSubagentTool } from "./tool/task"
import { createDismissNpcTool } from "./tool/dismiss-npc"
import { createSkillTool, discoverSkills, fmtSkills } from "./tool/skill"
import { createMessageTool } from "./tool/message"
import { createNotifyTool } from "./tool/notify"
import { createUpdateSceneTool } from "./tool/scene"
import { AgentRegistry, loadAgents } from "./agent"
import { buildPrimarySystemPrompt } from "./agent/prompt"
import type { GameMode } from "./game/instance"
import { SubagentDispatcher } from "./agent/subagent"
import { AgentLoop } from "./agent/loop"
import { SessionStore } from "./session/store"
import { SessionManager } from "./session/manager"
import { WorkspaceGuard } from "./workspace/guard"
import { ChatManager } from "./chat/manager"
import { SceneManager } from "./scene/manager"
import type { WorkspaceID } from "./workspace/types"
import type { SceneState } from "./shared/schemas"

export interface App {
  model: OpenAIModel
  agentRegistry: AgentRegistry
  toolRegistry: ToolRegistry
  sessionManager: SessionManager
  chatManager: ChatManager
  sceneManager: SceneManager
  dispatcher: SubagentDispatcher
  primaryAgent: AgentLoop
  workspacePath: string
  sessionRef: { id: string }
  onSceneUpdate?: (state: SceneState) => void
}

export function createApp(options: {
  dataDir?: string
  workspaceId?: WorkspaceID
  workspacePath?: string
  skillsDir?: string
  primarySessionId?: string
  gameMode?: GameMode
  activeGameSlug?: string
  activeGameSkill?: string
  modelConfig: ModelConfig
  onMessage?: (senderName: string, content: string) => void
}): App {
  const model = new OpenAIModel(options.modelConfig)

  const agentRegistry = loadAgents()

  if (!agentRegistry.getPrimary()) throw new Error("No primary agent found")

  const gameMode = options.gameMode ?? "build"
  const activeGameSlug = options.activeGameSlug
  const activeGameSkill = options.activeGameSkill ?? "dnd"
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
  const sceneManager = new SceneManager(dataDir)

  const sessionRef = { id: options.primarySessionId ?? "sess_primary" }
  const onMessage = options.onMessage

  const dispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry, sessionManager, workspaceId, (ctx) => {
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
  })

  const notifyFn = async (content: string, targets: import("./tool/notify").NotifyTarget[]) => {
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

  const sceneUpdateRef: { fn?: (state: SceneState) => void } = {}
  if (gameMode === "play") {
    toolRegistry.register(
      createUpdateSceneTool(sceneManager, sessionRef, workspacePath, (state) => {
        sceneUpdateRef.fn?.(state)
      }),
    )
  }

  const skills = discoverSkills(skillsDir ?? path.join(workspacePath, "skills"))
  const skillsSection = fmtSkills(skills, false)
  const systemPrompt = buildPrimarySystemPrompt({
    agentRegistry,
    gameMode,
    activeGameSlug,
    activeGameSkill,
    skillsSection,
  })

  const agentDisplayName = gameMode === "play" ? "DM" : "Builder"
  const primaryAgent = new AgentLoop(model, toolRegistry, {
    systemPrompt,
    maxIterations: gameMode === "build" ? 50 : 30,
    onResponse: (response) => {
      chatManager.sendMessage(sessionRef.id, {
        content: response,
        senderId: "agent",
        senderName: agentDisplayName,
        senderRole: "agent",
      })
      onMessage?.(agentDisplayName, response)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      chatManager.sendMessage(sessionRef.id, {
        content: `Agent error: ${message}`,
        senderId: "system",
        senderName: "System",
        senderRole: "system",
      })
    },
  })

  const app: App = {
    model,
    agentRegistry,
    toolRegistry,
    sessionManager,
    chatManager,
    sceneManager,
    dispatcher,
    primaryAgent,
    workspacePath,
    sessionRef,
  }

  Object.defineProperty(app, "onSceneUpdate", {
    get: () => sceneUpdateRef.fn,
    set: (fn: ((state: SceneState) => void) | undefined) => {
      sceneUpdateRef.fn = fn
    },
    enumerable: true,
    configurable: true,
  })

  return app
}
