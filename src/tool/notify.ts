import type { Tool, ToolResult } from "./base"

export interface NotifyTarget {
  session_id: string
}

export type NotifyFn = (content: string, targets: NotifyTarget[]) => Promise<{ sessionId: string; response: string }[]>

export function createNotifyTool(notifyFn: NotifyFn): Tool {
  return {
    id: "notify",
    description:
      "Send a notification to NPC agents and get their responses. " +
      "NPCs process the notification and return what their character would say/do. " +
      "You then decide how to present their response to the player (via message/voice_speak). " +
      "Multiple targets are processed in parallel.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The notification content: what happened, what the player said, or what you want the NPC to react to",
        },
        targets: {
          type: "array",
          description: "Which NPCs to notify",
          items: {
            type: "object",
            properties: {
              session_id: {
                type: "string",
                description: "The NPC subagent session ID",
              },
            },
            required: ["session_id"],
          },
        },
      },
      required: ["content", "targets"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const content = args.content as string
      const targets = args.targets as NotifyTarget[]

      if (!content) {
        return { content: "Error: content is required", isError: true }
      }
      if (!targets || targets.length === 0) {
        return { content: "Error: at least one target is required", isError: true }
      }

      const results = await notifyFn(content, targets)

      const formatted = results
        .map((r) => `<npc_response session="${r.sessionId}">\n${r.response}\n</npc_response>`)
        .join("\n\n")

      return { content: formatted }
    },
  }
}
