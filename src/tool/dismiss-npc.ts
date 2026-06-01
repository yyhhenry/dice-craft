import type { Tool, ToolResult } from "./base"
import type { SubagentDispatcher } from "../agent/subagent"

export function createDismissNpcTool(dispatcher: SubagentDispatcher): Tool {
  return {
    id: "dismiss_npc",
    description: "Dismiss an NPC subagent permanently. Use when starting a new game or when the user explicitly ends the current game. Do NOT dismiss NPCs just because a game round ended — the user may continue.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The session ID of the NPC to dismiss",
        },
      },
      required: ["session_id"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const sessionId = args.session_id as string

      if (!dispatcher.hasSession(sessionId)) {
        return { content: `NPC session not found: ${sessionId}`, isError: true }
      }

      dispatcher.dismiss(sessionId)
      return { content: `NPC dismissed (sessionId: ${sessionId})` }
    },
  }
}
