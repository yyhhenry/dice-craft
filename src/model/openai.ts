import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { z } from "zod"
import type { Tool, ToolCall } from "../tool/base"

export interface ModelConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatResponse {
  content: string | null
  reasoningContent: string | null
  toolCalls: ToolCall[] | null
  finishReason: string | null
  usage?: ChatUsage | null
}

export interface StreamCallbacks {
  onToken?: (token: string) => void
  onToolCall?: (call: ToolCall) => void
}

const MessageSchema = z.object({
  content: z.string().nullable().optional(),
  reasoning_content: z.string().nullable().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
})

function parseMessage(raw: unknown): z.infer<typeof MessageSchema> {
  return MessageSchema.parse(raw)
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
    _callbacks?: StreamCallbacks,
  ): Promise<ChatResponse> {
    const request: OpenAI.ChatCompletionCreateParams = {
      model: this.config.model,
      messages,
      stream: false,
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

    const response = await this.client.chat.completions.create(request)

    const choice = response.choices[0]
    if (!choice) {
      return { content: null, reasoningContent: null, toolCalls: null, finishReason: null, usage: null }
    }

    const message = parseMessage(choice.message)
    const content = message.content || null
    const reasoningContent = message.reasoning_content || null
    const finishReason = choice.finish_reason || null

    let toolCallsArray: ToolCall[] | null = null
    if (message.tool_calls && message.tool_calls.length > 0) {
      toolCallsArray = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      }))
    }

    const usage: ChatUsage | null = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null

    return { content, reasoningContent, toolCalls: toolCallsArray, finishReason, usage }
  }
}
