import type { Tool, ToolResult } from "./base"
import type { ChatManager } from "../chat/manager"
import type { SenderRole } from "../chat/types"

export function createMessageTool(
  chatManager: ChatManager,
  sessionRef: { id: string },
  senderId: string,
  defaultRole: SenderRole,
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
          description: "消息内容。像聊天一样简短自然。动作用 () 包裹。",
        },
        sender_name: {
          type: "string",
          description: "显示名称（GM / Builder / 角色名）",
        },
        avatar_text: {
          type: "string",
          description: "头像文字（1-2字，role=npc 时必填）。小柚→柚，老陈→陈。role=agent 时可省略。",
        },
        role: {
          type: "string",
          enum: ["agent", "npc", "system"],
          description:
            "agent = GM/Builder 叙事（扳手图标），npc = 角色对话（头像文字），system = 系统提示（居中灰字，如玩家动作描述）",
        },
      },
      required: ["content", "sender_name", "role"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const content = args.content as string
      const senderName = args.sender_name as string
      const avatarText = args.avatar_text as string | undefined
      const role = (args.role as SenderRole) || defaultRole
      if (!content) {
        return { content: "Error: content is required", isError: true }
      }
      if (!senderName) {
        return { content: "Error: sender_name is required", isError: true }
      }
      if (role === "npc" && (!avatarText || avatarText.length > 2)) {
        return { content: "Error: avatar_text is required for npc role (1-2 chars)", isError: true }
      }

      const msg = chatManager.sendMessage(sessionRef.id, {
        content,
        senderId,
        senderRole: role,
        senderName,
        avatarText,
      })

      if (onMessage) {
        onMessage(msg.senderName, content)
      }

      return { content: "Message sent." }
    },
  }
}
