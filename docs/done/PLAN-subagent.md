# DiceCraft - Subagent 设计计划

## Context

PLAN-agent-loop 已完成：AI SDK 封装、Tool 接口、Agent 循环、CLI 入口均已实现并通过测试。

现在需要设计 Subagent 系统，让 Primary Agent 能够派发子任务给专门的 Agent 处理。参考 opencode 的 `task.ts` 和 `agent.ts` 设计。

## 统一 Subagent 模型

所有 subagent 都通过 `spawn` 创建，区别仅在于参数配置：

| 参数 | 含义 |
|------|------|
| `background` | `true` = 后台运行，立即返回 sessionId；`false` = 等待执行完毕，返回结果 |
| `visible` | `true` = 结果直接展示给用户；`false` = 结果作为 tool 返回值给 Primary |

### 典型组合

| 场景 | background | visible | 行为 |
|------|------------|---------|------|
| Explore/Review | false | false | 等待结果，作为 tool 返回值给 Primary 整合 |
| NPC 对话 | true | true | 启动后自主运行，直接向群聊发消息 |
| 后台任务 | true | false | 启动后返回 sessionId，结果可通过 send() 获取 |

### Session 生命周期

- `spawn()` 创建 subagent，返回 sessionId
- subagent 执行完后**不销毁**，保留 session
- 主 agent 或其他群聊成员可通过 `send(sessionId, message)` 继续与 subagent 交互
- 异步接收 subagent 完成的消息后，subagent 仍然可用

## AgentLoop 事件注入机制

异步消息（用户输入、subagent 完成通知等）需要在不打断当前执行的情况下注入到 AgentLoop 中。

### 设计方案

```typescript
// src/agent/loop.ts
interface PendingEvent {
  source: string  // "user" | "subagent:sessionId" | etc.
  content: string
}

class AgentLoop {
  private eventQueue: PendingEvent[] = []

  // 外部注入事件（线程安全，不打断当前执行）
  injectEvent(source: string, content: string): void {
    this.eventQueue.push({ source, content })
  }

  // 内部检查：在每次工具调用结束后调用
  private flushEvents(): ChatCompletionMessageParam[] {
    if (this.eventQueue.length === 0) return []

    const events = this.eventQueue.splice(0)
    return events.map(e => ({
      role: "user" as const,
      content: `[Event from ${e.source}]: ${e.content}`
    }))
  }

  async run(...) {
    // 在工具调用循环中，每次工具执行完毕后检查事件队列
    for (const call of result.toolCalls) {
      // ... 执行工具 ...

      // 注入等待中的事件
      const eventMessages = this.flushEvents()
      messages.push(...eventMessages)
    }
  }
}
```

### 行为说明

1. **不打断执行**：事件队列是异步的，`injectEvent()` 立即返回，不阻塞当前流程
2. **时机**：事件在工具调用结束后、下一次 LLM 调用前注入
3. **来源标注**：每条事件标注来源（用户、subagent、系统等），让 LLM 知道上下文
4. **批量处理**：一次工具调用期间积累的事件会批量注入

### 消息格式规范

**事件注入**（XML 包裹，防止内容污染）：
```
<event source="user">
再帮我查一下天气
</event>

<event source="subagent:abc123">
探索完成，找到了3个相关文件
</event>

<event source="system">
时间已到，请尽快完成任务
</event>
```

### 使用场景

```typescript
// 用户在 agent 执行过程中输入新消息
loop.injectEvent("user", "再帮我查一下天气")

// subagent 完成后台任务，通知主 agent
loop.injectEvent(`subagent:${sessionId}`, "探索完成，找到了3个相关文件")

// 系统事件
loop.injectEvent("system", "时间已到，请尽快完成任务")
```

## 目录结构

```
src/
├── agent/
│   ├── loop.ts            # Agent 循环（已有，需添加事件注入）
│   ├── agent.ts           # Agent 类型定义、注册表
│   ├── subagent.ts        # Subagent 调度器
│   └── prompt/
│       ├── builder.txt    # Primary Agent prompt（已有）
│       ├── explore.txt    # Explore Subagent prompt
│       └── review.txt     # Review Subagent prompt
├── tool/
│   ├── base.ts            # Tool 接口（已有）
│   ├── time.ts            # get_current_time（已有）
│   └── task.ts            # spawn_subagent 工具
└── ...
```

## 核心设计

### Agent 定义

```typescript
// src/agent/agent.ts
interface AgentInfo {
  name: string
  description: string
  mode: "primary" | "subagent" | "all"
  systemPrompt?: string
}

class AgentRegistry {
  private agents: Map<string, AgentInfo>
  register(agent: AgentInfo): void
  get(name: string): AgentInfo | undefined
  list(): AgentInfo[]
}
```

### Subagent 调度器

```typescript
// src/agent/subagent.ts
interface SpawnOptions {
  background?: boolean  // default: false
  visible?: boolean     // default: false
}

interface SubagentResult {
  content: string
  sessionId: string
}

class SubagentDispatcher {
  constructor(model: OpenAIModel, toolRegistry: ToolRegistry, agentRegistry: AgentRegistry)

  // 统一 spawn 接口
  async spawn(agentName: string, prompt: string, options?: SpawnOptions): Promise<SubagentResult>

  // 向已存在的 subagent 发送消息
  async send(sessionId: string, message: string): Promise<SubagentResult>
}
```

### Tool：spawn_subagent

```typescript
// src/tool/task.ts
// 给 Primary Agent 使用的 tool
{
  id: "spawn_subagent",
  description: "Spawn a subagent to handle a specific task.",
  parameters: {
    type: "object",
    properties: {
      agent_type: {
        type: "string",
        description: "The type of agent to use: explore, general, review, npc"
      },
      prompt: {
        type: "string",
        description: "Detailed task description for the subagent"
      },
      background: {
        type: "boolean",
        description: "If true, return sessionId immediately without waiting for result"
      },
      visible: {
        type: "boolean",
        description: "If true, subagent output is shown directly to user instead of returned as tool result"
      }
    },
    required: ["agent_type", "prompt"]
  }
}
```

## 实现步骤

### Phase 1: 基础设施

- `AgentInfo` 接口、`AgentRegistry` 类
- 注册内置 agents：`build`（primary）、`explore`、`general`、`review`
- `SubagentDispatcher` 类，实现 `spawn()` 和 `send()`

### Phase 2: AgentLoop 事件注入

- 添加 `eventQueue` 和 `injectEvent()` 方法
- 在工具调用循环中调用 `flushEvents()` 注入等待的事件
- 测试：模拟异步事件注入，验证不打断执行

### Phase 3: 工具集成

- `SpawnSubagentTool` 实现
- 支持 `background=false` 模式（等待结果返回）
- subagent 执行完后保留 session，可通过 send() 继续对话
- 集成到 CLI，测试 Primary 派发 explore subagent

### Phase 4: Subagent Prompts

- `explore.txt` - 研究型 subagent prompt（搜索、分析、总结）
- `review.txt` - 审查型 subagent prompt（发现问题、逻辑验证）

### Phase 5: 后台与可见模式

- 支持 `background=true` 模式（立即返回 sessionId）
- 支持 `visible=true` 模式（结果直接展示给用户）
- 群聊/频道抽象，subagent 直接向群聊发消息

## 关键设计决策

1. **统一 spawn 模型**：所有 subagent 都通过 spawn 创建，用参数控制行为。
2. **Session 持久化**：subagent 执行完后不销毁，保留 session 供后续 send() 使用。
3. **事件注入**：通过 `injectEvent()` 实现异步消息注入，不打断当前执行。
4. **上下文隔离**：subagent 拿不到 Primary 的完整历史，只看到传入的 prompt。
5. **工具共享**：subagent 可以有自己的 ToolRegistry（比如 explore 只需要 read/glob/grep）。

## 验证方式

1. `bun run check` 全部通过
2. CLI 中输入需要探索的任务，Primary 自动派发 explore subagent
3. subagent 返回结果后，Primary 整合回复用户
4. 测试 spawn(background=false)：独立上下文、结果正确返回
5. 测试 send()：向已有 subagent 继续发消息
6. 测试事件注入：模拟异步事件，验证正确注入且不打断执行
7. 测试未知 agent type 的错误处理

## 参考文件

- `references/opencode/packages/opencode/src/tool/task.ts` - TaskTool 完整实现
- `references/opencode/packages/opencode/src/tool/task.txt` - TaskTool 用户描述
- `references/opencode/packages/opencode/src/agent/agent.ts` - Agent 定义和注册
- `references/opencode/packages/opencode/src/agent/prompt/explore.txt` - Explore prompt
