import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "../tool/base"
import type { ChatManager } from "../chat/manager"
import type { VoiceSynthesizer } from "./synthesizer"

export interface VoiceToolContext {
  synthesizer: VoiceSynthesizer
  chatManager: ChatManager
  workspacePath: string
  dataDir: string
  sessionRef: { id: string }
  onMessage?: (senderName: string, content: string) => void
}

export function createVoiceDesignTool(ctx: VoiceToolContext): Tool {
  return {
    id: "voice_design",
    description:
      "设计并生成角色音色样本。用文字描述声音特征，系统生成对应音频。\n" +
      "如果指定 save_as，保存到该路径供 voice_speak 复用（如 'games/tavern/voices/old_chen.wav'）。\n" +
      "音色描述写法详见 skill('voice')。",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "音色描述（1-2 句，描写声音本身的特征）",
        },
        sample_text: {
          type: "string",
          description: "样本台词（2-5 句，展示角色说话风格）",
        },
        save_as: {
          type: "string",
          description: "保存路径（如 'games/cafe/voices/xiaoyou.wav'）",
        },
      },
      required: ["description", "sample_text"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const description = args.description as string
      const sampleText = args.sample_text as string
      const saveAs = args.save_as as string | undefined

      if (!description || !sampleText) {
        return { content: "Error: description and sample_text are required", isError: true }
      }

      try {
        const audioBuffer = await ctx.synthesizer.design(description, sampleText)

        if (saveAs) {
          const filePath = path.join(ctx.workspacePath, saveAs)
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          fs.writeFileSync(filePath, audioBuffer)
          return { content: `Voice sample saved to ${saveAs} (${audioBuffer.length} bytes)` }
        }

        return { content: `Voice sample generated (${audioBuffer.length} bytes, not saved)` }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: `Error generating voice: ${msg}`, isError: true }
      }
    },
  }
}

export function createVoiceSpeakTool(ctx: VoiceToolContext): Tool {
  return {
    id: "voice_speak",
    description:
      "为角色生成语音片段，作为独立语音消息发送到聊天中。\n" +
      "text 是「高光台词」——从消息中提取最适合说出来的 1-2 句（≤30字），不是照搬原文。\n" +
      "text 支持任意位置的音频标签如 (慵懒)、[叹气]、(温柔) 等控制语气情绪。",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "高光台词（≤30字，支持音频标签）",
        },
        voice_file: {
          type: "string",
          description: "音色样本路径（如 'games/tavern/voices/old_chen.wav'）",
        },
        character_name: {
          type: "string",
          description: "角色名（作为消息发送者显示）",
        },
        avatar_text: {
          type: "string",
          description: "头像文字（1-2字）",
        },
      },
      required: ["text", "voice_file", "character_name", "avatar_text"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const text = args.text as string
      const voiceFile = args.voice_file as string
      const characterName = args.character_name as string
      const avatarText = args.avatar_text as string

      if (!text || !characterName || !voiceFile) {
        return { content: "Error: text, voice_file, and character_name are required", isError: true }
      }

      try {
        const fullPath = path.resolve(ctx.workspacePath, voiceFile)
        if (!fs.existsSync(fullPath)) {
          return { content: `Error: voice file not found: ${voiceFile}`, isError: true }
        }
        const voiceData = fs.readFileSync(fullPath)
        const audioBuffer = await ctx.synthesizer.clone(voiceData, text)

        // Generate a message ID for the audio file name
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const voiceDir = path.join(ctx.dataDir, "sessions", ctx.sessionRef.id, "voice")
        fs.mkdirSync(voiceDir, { recursive: true })
        const audioPath = path.join(voiceDir, `${msgId}.wav`)
        fs.writeFileSync(audioPath, audioBuffer)

        const duration = estimateDuration(audioBuffer)

        // Send chat message with voice field included
        ctx.chatManager.sendMessage(ctx.sessionRef.id, {
          id: msgId,
          content: text,
          senderId: "voice",
          senderName: characterName,
          senderRole: "npc",
          avatarText,
          voice: { asset: `voice/${msgId}.wav`, duration },
        })

        if (ctx.onMessage) {
          ctx.onMessage(characterName, text)
        }

        return { content: `Voice message sent as ${characterName}: "${text}" (${duration.toFixed(1)}s)` }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        return { content: `Error generating voice: ${errMsg}`, isError: true }
      }
    },
  }
}

function estimateDuration(wavBuffer: Buffer): number {
  if (wavBuffer.length < 44) return 0
  const byteRate = wavBuffer.readUInt32LE(28)
  if (byteRate === 0) return 0
  const dataSize = wavBuffer.length - 44
  return dataSize / byteRate
}
