import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import type { Tool, ToolCall } from "../tool/base"

export interface ModelConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
}

export interface ChatResponse {
  content: string | null
  toolCalls: ToolCall[] | null
  finishReason: string | null
}

export interface StreamCallbacks {
  onToken?: (token: string) => void
  onToolCall?: (call: ToolCall) => void
}

export class OpenAIModel {
  private client: OpenAI
  private config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    })
  }

  async chat(
    messages: ChatCompletionMessageParam[],
    tools?: Tool[],
    callbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const request: OpenAI.ChatCompletionCreateParams = {
      model: this.config.model,
      messages,
      stream: true,
    }

    if (tools && tools.length > 0) {
      request.tools = tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.id,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
    }

    const stream = await this.client.chat.completions.create(request)

    let content = ""
    const toolCalls: Map<number, ToolCall> = new Map()
    let finishReason: string | null = null

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        content += delta.content
        callbacks?.onToken?.(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index ?? 0
          if (!toolCalls.has(index)) {
            toolCalls.set(index, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: {},
            })
          }
          const existing = toolCalls.get(index)!
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name = tc.function.name
          if (tc.function?.arguments) {
            try {
              existing.arguments = JSON.parse(tc.function.arguments)
            } catch {
              existing.arguments = {}
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason
      }
    }

    const toolCallsArray = toolCalls.size > 0 ? Array.from(toolCalls.values()) : null

    if (toolCallsArray) {
      for (const call of toolCallsArray) {
        callbacks?.onToolCall?.(call)
      }
    }

    return {
      content: content || null,
      toolCalls: toolCallsArray,
      finishReason,
    }
  }
}
