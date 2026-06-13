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
      // @ts-expect-error MiMo TTS extension: audio param not in OpenAI types
      audio: { format: "wav" },
    })

    return this.extractAudio(response)
  }

  async clone(voiceFileBuffer: Buffer, text: string): Promise<Buffer> {
    const dataUrl = this.bufferToDataUrl(voiceFileBuffer)

    const response = await this.client.chat.completions.create({
      model: "mimo-v2.5-tts-voiceclone",
      messages: [{ role: "assistant", content: text }],
      audio: { format: "wav", voice: dataUrl },
    })

    return this.extractAudio(response)
  }

  private extractAudio(response: OpenAI.ChatCompletion): Buffer {
    const message = response.choices[0]?.message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audio = (message as any)?.audio
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
