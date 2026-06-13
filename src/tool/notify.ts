import type { Tool, ToolResult } from "./base"

export interface NotifyTarget {
  session_id: string
  expect_reply?: boolean
}

export type NotifyFn = (content: string, targets: NotifyTarget[]) => Promise<void>

export function createNotifyTool(notifyFn: NotifyFn): Tool {
  return {
    id: "notify",
    description:
      "Send a notification to one or more NPC agents. " +
      "Use this to forward user messages to NPCs, inform NPCs of scene events, " +
      "or prompt NPCs to react. " +
      "This does NOT write to the chat - it only sends to the NPC's context. " +
      "The NPC decides whether to speak based on the notification content.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The notification content: user's message, scene description, or GM instruction",
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
              expect_reply: {
                type: "boolean",
                description:
                  "Whether to wait for the NPC to finish processing before continuing. " +
                  "true = block until NPC is done (use when you need their response before your next action). " +
                  "false = fire and forget (default, NPC processes in background).",
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

      await notifyFn(content, targets)

      const summary = targets.map((t) => `${t.session_id}(${t.expect_reply ? "reply" : "silent"})`).join(", ")
      return { content: `Notified: ${summary}` }
    },
  }
}
