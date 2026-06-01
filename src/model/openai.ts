import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import type { Tool, ToolCall } from "../tool/base"

export interface ModelConfig {
  baseUrl: string
  apiKey: string
  model: string
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
      return { content: null, toolCalls: null, finishReason: null }
    }

    const content = choice.message.content || null
    const finishReason = choice.finish_reason || null

    let toolCallsArray: ToolCall[] | null = null
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      toolCallsArray = choice.message.tool_calls
        .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || "{}"),
        }))
    }

    return { content, toolCalls: toolCallsArray, finishReason }
  }
}
