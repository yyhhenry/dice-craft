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
      "如果指定 save_as，保存到 .voice/<save_as>.wav 供 voice_speak 复用。\n" +
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
          description: "保存文件名（不含扩展名），省略则不保存",
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
          const voiceDir = path.join(ctx.workspacePath, ".voice")
          fs.mkdirSync(voiceDir, { recursive: true })
          const filePath = path.join(voiceDir, `${saveAs}.wav`)
          fs.writeFileSync(filePath, audioBuffer)
          return { content: `Voice sample saved to .voice/${saveAs}.wav (${audioBuffer.length} bytes)` }
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
      "可在 text 中使用整体风格前缀如 (慵懒)、(温柔) 等。\n" +
      "提供 voice_file（克隆已有音色）或 voice_description（临时描述）之一。",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "高光台词（≤30字，可含整体风格前缀）",
        },
        voice_file: {
          type: "string",
          description: "音色样本路径（如 '.voice/old_chen.wav'），音色克隆模式",
        },
        voice_description: {
          type: "string",
          description: "临时音色描述，音色设计模式（无需预存文件）",
        },
        character_name: {
          type: "string",
          description: "角色名（作为消息发送者显示）",
        },
      },
      required: ["text", "character_name"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const text = args.text as string
      const voiceFile = args.voice_file as string | undefined
      const voiceDescription = args.voice_description as string | undefined
      const characterName = args.character_name as string

      if (!text || !characterName) {
        return { content: "Error: text and character_name are required", isError: true }
      }
      if (!voiceFile && !voiceDescription) {
        return { content: "Error: provide either voice_file or voice_description", isError: true }
      }

      try {
        let audioBuffer: Buffer

        if (voiceFile) {
          const fullPath = path.resolve(ctx.workspacePath, voiceFile)
          if (!fs.existsSync(fullPath)) {
            return { content: `Error: voice file not found: ${voiceFile}`, isError: true }
          }
          const voiceData = fs.readFileSync(fullPath)
          audioBuffer = await ctx.synthesizer.clone(voiceData, text)
        } else {
          audioBuffer = await ctx.synthesizer.design(voiceDescription!, text)
        }

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
