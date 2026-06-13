import OpenAI from "openai"
import type { TtsConfig } from "./types"

export class VoiceSynthesizer {
  private client: OpenAI

  constructor(config: TtsConfig) {
    this.client = new OpenAI({
      baseURL: config.apiBaseUrl,
      apiKey: config.apiKey,
    })
  }

  async design(description: string, text: string): Promise<Buffer> {
    const response = await this.client.chat.completions.create({
      model: "mimo-v2.5-tts-voicedesign",
      messages: [
        { role: "user", content: description },
        { role: "assistant", content: text },
      ],
      modalities: ["audio"],
      audio: { format: "wav", voice: "alloy" },
    })

    return this.extractAudio(response)
  }

  async clone(voiceFileBuffer: Buffer, text: string): Promise<Buffer> {
    const dataUrl = this.bufferToDataUrl(voiceFileBuffer)

    const response = await this.client.chat.completions.create({
      model: "mimo-v2.5-tts-voiceclone",
      messages: [{ role: "assistant", content: text }],
      modalities: ["audio"],
      audio: { format: "wav", voice: dataUrl },
    })

    return this.extractAudio(response)
  }

  private extractAudio(response: OpenAI.ChatCompletion): Buffer {
    const audio = response.choices[0]?.message.audio
    if (!audio?.data) {
      throw new Error("No audio data returned from TTS API")
    }
    return Buffer.from(audio.data, "base64")
  }

  private bufferToDataUrl(buffer: Buffer): string {
    const b64 = buffer.toString("base64")
    return `data:audio/wav;base64,${b64}`
  }
}
