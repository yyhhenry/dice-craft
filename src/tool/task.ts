import type { Tool, ToolResult } from "./base"
import type { SubagentDispatcher } from "../agent/subagent"

export function createSpawnSubagentTool(dispatcher: SubagentDispatcher, sessionRef: { id: string }): Tool {
  return {
    id: "spawn_subagent",
    description:
      "Spawn a subagent. NPC agents run in background (persistent, use notify to talk to them). Other types (explore, general, review) run in foreground and return their result.",
    parameters: {
      type: "object",
      properties: {
        agent_type: {
          type: "string",
          description: "Agent type: npc (persistent background), explore, general, review (foreground, returns result)",
        },
        prompt: {
          type: "string",
          description: "Detailed task description or character setup for the subagent",
        },
      },
      required: ["agent_type", "prompt"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const agentType = args.agent_type as string
      const prompt = args.prompt as string
      const background = agentType === "npc"

      try {
        const result = await dispatcher.spawn(agentType, prompt, { background }, sessionRef.id)

        if (background) {
          return {
            content: `NPC spawned (sessionId: ${result.sessionId}). Use notify to communicate with it.`,
          }
        }

        return {
          content: result.content || `Subagent ${agentType} completed (sessionId: ${result.sessionId})`,
        }
      } catch (error) {
        return {
          content: `Error spawning subagent: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        }
      }
    },
  }
}
