export interface JSONSchema {
  type?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  description?: string
  items?: JSONSchema
  enum?: unknown[]
  default?: unknown
  [key: string]: unknown
}

export interface ToolResult {
  content: string
  isError?: boolean
}

export interface Tool {
  id: string
  description: string
  parameters: JSONSchema
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.id, tool)
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id)
  }

  all(): Tool[] {
    return Array.from(this.tools.values())
  }

  toOpenAI(): Array<{
    type: "function"
    function: {
      name: string
      description: string
      parameters: JSONSchema
    }
  }> {
    return this.all().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }
}
