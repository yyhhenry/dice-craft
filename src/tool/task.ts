import type { Tool, ToolResult } from "./base"
import type { SubagentDispatcher } from "../agent/subagent"

export function createSpawnSubagentTool(dispatcher: SubagentDispatcher): Tool {
  return {
    id: "spawn_subagent",
    description: "Spawn a subagent to handle a specific task.",
    parameters: {
      type: "object",
      properties: {
        agent_type: {
          type: "string",
          description: "The type of agent to use: explore, general, review, npc",
        },
        prompt: {
          type: "string",
          description: "Detailed task description for the subagent",
        },
        background: {
          type: "boolean",
          description: "If true, return sessionId immediately without waiting for result",
        },
        visible: {
          type: "boolean",
          description: "If true, subagent output is shown directly to user instead of returned as tool result",
        },
      },
      required: ["agent_type", "prompt"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const agentType = args.agent_type as string
      const prompt = args.prompt as string
      const background = (args.background as boolean) ?? false
      const visible = (args.visible as boolean) ?? false

      try {
        const result = await dispatcher.spawn(agentType, prompt, { background, visible })

        if (background) {
          return {
            content: `Subagent spawned with sessionId: ${result.sessionId}`,
          }
        }

        return {
          content: result.content,
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
