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
      "Write ONLY what you want to say — like typing in a chat box. " +
      "You can wrap your own actions in () but do NOT write other characters' actions.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "What you want to say. Keep it short like a chat message. " +
            "Wrap your own actions in (), e.g. '(smiles) Hello there!'",
        },
        sender_name: {
          type: "string",
          description:
            "Your display name. Set to your character/role name (e.g. 'GM', 'Alice', 'Bob').",
        },
      },
      required: ["content", "sender_name"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const content = args.content as string
      const senderName = args.sender_name as string
      if (!content) {
        return { content: "Error: content is required", isError: true }
      }
      if (!senderName) {
        return { content: "Error: sender_name is required", isError: true }
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
