import type { Tool, ToolResult } from "./base"
import type { ChatManager } from "../chat/manager"
import type { SenderRole } from "../chat/types"

export function createMessageTool(
  chatManager: ChatManager,
  sessionRef: { id: string },
  senderId: string,
  senderRole: SenderRole,
  onMessage?: (content: string) => void,
): Tool {
  return {
    id: "message",
    description:
      "Send a message to the chat. The message will be visible to the user. " +
      "Use this to communicate: narration, system events, or NPC dialogue. " +
      "Your identity is determined by who you are - you cannot impersonate others.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The message content to send",
        },
      },
      required: ["content"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const content = args.content as string
      if (!content) {
        return { content: "Error: content is required", isError: true }
      }

      chatManager.sendMessage(sessionRef.id, {
        content,
        senderId,
        senderRole,
      })

      if (onMessage) {
        onMessage(content)
      }

      return { content: "Message sent." }
    },
  }
}
