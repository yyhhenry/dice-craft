# DiceCraft v0 - AI SDK & Agent Loop 实现计划

## Context

实现 DiceCraft 的核心模块：AI SDK 封装、Tool 接口、Agent 循环。参考 opencode 项目的设计，简化为 TypeScript + Bun 版本。

opencode 使用 Effect-TS 和复杂的依赖注入，我们采用更简单的函数式设计。

## 目标目录结构

```
src/
├── model/
│   └── openai.ts          # OpenAI SDK 封装
├── tool/
│   ├── base.ts            # Tool 接口、ToolResult、ToolRegistry
│   └── time.ts            # get_current_time 实现
├── agent/
│   └── loop.ts            # Agent 循环
└── index.ts               # CLI 入口
```

## 实现步骤

### Phase 1: Tool 基础

**文件**: `src/tool/base.ts`
```typescript
interface Tool {
  id: string
  description: string
  parameters: Record<string, unknown>  // JSON Schema
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
}

interface ToolResult {
  content: string
  isError?: boolean
}

class ToolRegistry {
  private tools: Map<string, Tool>
  register(tool: Tool): void
  get(id: string): Tool | undefined
  all(): Tool[]
  toOpenAI(): OpenAI.ChatCompletionTool[]
}
```

**文件**: `src/tool/time.ts`
- `GetCurrentTimeTool` 实现，支持 `timezone_offset` 参数

### Phase 2: Model 层

**文件**: `src/model/openai.ts`
```typescript
interface ModelConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
}

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface ChatResponse {
  content: string | null
  toolCalls: ToolCall[] | null
  finishReason: string | null
}

interface StreamCallbacks {
  onToken?: (token: string) => void
  onToolCall?: (call: ToolCall) => void
}

class OpenAIModel {
  constructor(config: ModelConfig)
  // 流式调用，通过回调实时输出
  async chat(messages: Message[], tools?: Tool[], callbacks?: StreamCallbacks): Promise<ChatResponse>
}
```

使用 OpenAI SDK 的 `chat.completions.create({ stream: true })`，从环境变量加载配置。流式输出 token，收集 tool calls。

### Phase 3: Agent 循环

**文件**: `src/agent/loop.ts`
```typescript
class AgentLoop {
  constructor(model: OpenAIModel, registry: ToolRegistry, systemPrompt: string)
  async run(messages: Message[]): Promise<string>
}
```

核心逻辑：
```
while (iterations < max) {
  response = await model.chat(messages, tools)
  if (response.toolCalls) {
    // 执行 tool，将结果加入 messages，继续循环
    for (const call of response.toolCalls) {
      const result = await registry.get(call.name)?.execute(call.arguments)
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content })
    }
    continue
  }
  return response.content  // 无 tool calls，返回结果
}
```

### Phase 4: 集成

**文件**: `src/index.ts`
- 加载 `.env`（dotenv）
- 创建 OpenAIModel、ToolRegistry、AgentLoop
- CLI 交互循环：用户输入 -> Agent 处理 -> 输出响应
- 支持 `/quit` 退出

### Phase 5: 依赖

已安装：
- `openai` - OpenAI SDK
- `dotenv` - 环境变量加载

### Phase 6: 测试

**文件**: `src/tool/time.test.ts`
- 测试 `GetCurrentTimeTool.execute()` 返回正确格式
- 测试默认时区 (UTC+8)
- 测试自定义时区

**文件**: `src/model/openai.test.ts`
- 测试 `ModelConfig` 从环境变量加载
- 测试 `ToolCall` 解析

**文件**: `src/agent/loop.test.ts`
- Mock `OpenAIModel.chat()`
- 测试正常对话（无 tool calls）
- 测试 tool call 执行和循环
- 测试最大迭代次数限制

## 关键设计决策

1. **简化设计**：不使用 Effect-TS，用简单的类和函数
2. **类型安全**：使用 TypeScript 接口定义
3. **流式输出**：使用 OpenAI streaming API，实时输出 token
4. **错误处理**：Tool 执行失败时返回错误信息给 LLM
5. **最大迭代次数**：默认 20，防止无限循环

## 验证方式

1. 运行 `bun run src/index.ts` 启动 CLI
2. 输入 "现在几点了？" 验证 get_current_time tool 调用
3. 输入普通问题验证正常对话
4. 输入 `/quit` 退出

## 参考文件

- `references/opencode/packages/opencode/src/tool/tool.ts` - Tool 接口设计
- `references/opencode/packages/opencode/src/agent/agent.ts` - Agent 配置
- `references/opencode/packages/opencode/src/tool/registry.ts` - Tool 注册
