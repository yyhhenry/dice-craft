import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { OpenAIModel, type StreamCallbacks } from "../model/openai"
import { ToolRegistry } from "../tool/base"

export interface AgentConfig {
  maxIterations?: number
  systemPrompt?: string
}

export class AgentLoop {
  private model: OpenAIModel
  private registry: ToolRegistry
  private maxIterations: number
  private systemPrompt: string | undefined

  constructor(model: OpenAIModel, registry: ToolRegistry, config: AgentConfig = {}) {
    this.model = model
    this.registry = registry
    this.maxIterations = config.maxIterations ?? 20
    this.systemPrompt = config.systemPrompt
  }

  async run(
    userMessage: string,
    history: ChatCompletionMessageParam[] = [],
    callbacks?: StreamCallbacks
  ): Promise<{ response: string; history: ChatCompletionMessageParam[] }> {
    const messages: ChatCompletionMessageParam[] = []

    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt })
    }

    messages.push(...history, { role: "user", content: userMessage })

    const tools = this.registry.all()
    let iterations = 0

    while (iterations < this.maxIterations) {
      iterations++

      const result = await this.model.chat(messages, tools.length > 0 ? tools : undefined, callbacks)

      if (result.content && !result.toolCalls) {
        messages.push({ role: "assistant", content: result.content })
        return {
          response: result.content,
          history: messages.slice(1),
        }
      }

      if (result.toolCalls) {
        const assistantMessage: ChatCompletionMessageParam = {
          role: "assistant",
          content: result.content,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
        messages.push(assistantMessage)

        for (const call of result.toolCalls) {
          const tool = this.registry.get(call.name)
          let toolResult: string

          if (tool) {
            try {
              const execResult = await tool.execute(call.arguments)
              toolResult = execResult.content
            } catch (error) {
              toolResult = `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
            }
          } else {
            toolResult = `Unknown tool: ${call.name}`
          }

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          })
        }
        continue
      }

      if (result.content) {
        messages.push({ role: "assistant", content: result.content })
        return {
          response: result.content,
          history: messages.slice(1),
        }
      }
    }

    return {
      response: "Max iterations reached. Please try again.",
      history: messages.slice(1),
    }
  }
}
