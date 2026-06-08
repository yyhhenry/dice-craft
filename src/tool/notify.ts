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
      "Send a notification to one or more NPC subagents (by session_id from spawn_subagent). " +
      "REQUIRED when the player talks to a spawned NPC: forward their words with expect_reply true. " +
      "Do NOT speak for NPCs in the message tool — notify instead. " +
      "This does NOT write to the chat; the NPC replies via its own message tool when expect_reply is true.",
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
                description: "Whether the NPC should reply via message tool (default false, just update context)",
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
