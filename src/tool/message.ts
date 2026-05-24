import type { Tool, ToolResult } from "./base"
import type { ChatManager } from "../chat/manager"
import type { SenderRole } from "../chat/types"

export function createMessageTool(
  chatManager: ChatManager,
  sessionRef: { id: string },
  senderId: string,
  senderRole: SenderRole,
  onMessage?: (senderName: string, content: string) => void,
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
        sender_name: {
          type: "string",
          description:
            "Display name for this message. For NPCs: your character name (e.g. '莉莉安', '凯尔'). " +
            "For GM: usually omit to use default.",
        },
      },
      required: ["content"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const content = args.content as string
      const senderName = args.sender_name as string | undefined
      if (!content) {
        return { content: "Error: content is required", isError: true }
      }

      const msg = chatManager.sendMessage(sessionRef.id, {
        content,
        senderId,
        senderRole,
        senderName,
      })

      if (onMessage) {
        onMessage(msg.senderName, content)
      }

      return { content: "Message sent." }
    },
  }
}
