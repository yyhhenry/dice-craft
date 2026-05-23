# DiceCraft - Subagent 设计计划

## Context

PLAN-agent-loop 已完成：AI SDK 封装、Tool 接口、Agent 循环、CLI 入口均已实现并通过测试。

现在需要设计 Subagent 系统，让 Primary Agent 能够派发子任务给专门的 Agent 处理。参考 opencode 的 `task.ts` 和 `agent.ts` 设计。

## 两种 Subagent 模式

### 1. Task Subagent（fork 模式）

**用途**：派发一个子任务，等待结果返回。一次性执行，不保留上下文。

**对应角色**：Explore（探索研究）、General（细节执行）、Review（质量审查）

**特点**：
- 独立上下文，只看到 Primary 传入的 prompt
- 执行完毕后返回结果文本给 Primary
- 不保留会话历史（每次都是新 session）
- Primary 可以并行派发多个 Task Subagent

**opencode 对应**：`task.ts` 中 `background=false` 的场景

### 2. NPC Subagent（spawn 模式）

**用途**：持久化的独立 Agent，拥有自己的知识和性格，可以跨多轮交互。

**对应角色**：游戏中的 NPC 角色

**特点**：
- 独立上下文，只知道自己应知的信息（信息隔离）
- 有唯一 ID，可以跨多轮对话
- GM Agent 通过 ID 引用已有的 NPC Subagent
- NPC 不知道其他 NPC 的私有信息
- 可以有自己的 system prompt（角色设定）

**opencode 对应**：`task.ts` 中 `task_id` 恢复已有 session 的机制

## 目录结构

```
src/
├── agent/
│   ├── loop.ts            # Agent 循环（已有）
│   ├── agent.ts           # Agent 类型定义、注册表
│   ├── subagent.ts        # Subagent 调度器
│   └── prompt/
│       ├── builder.txt    # Primary Agent prompt（已有）
│       ├── explore.txt    # Explore Subagent prompt
│       └── review.txt     # Review Subagent prompt
├── tool/
│   ├── base.ts            # Tool 接口（已有）
│   ├── time.ts            # get_current_time（已有）
│   └── task.ts            # dispatch_subagent 工具
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
interface SubagentResult {
  content: string
  sessionId: string
}

class SubagentDispatcher {
  constructor(model: OpenAIModel, toolRegistry: ToolRegistry, agentRegistry: AgentRegistry)

  // fork 模式：执行一次，返回结果
  async fork(agentName: string, prompt: string): Promise<SubagentResult>

  // spawn 模式：创建持久 NPC，返回 sessionId
  async spawn(agentName: string, sessionId?: string): Promise<string>

  // 向已存在的 subagent 发送消息
  async send(sessionId: string, message: string): Promise<SubagentResult>
}
```

### Tool：dispatch_subagent

```typescript
// src/tool/task.ts
// 给 Primary Agent 使用的 tool
{
  id: "dispatch_subagent",
  description: "Launch a subagent to handle a specific task.",
  parameters: {
    type: "object",
    properties: {
      agent_type: {
        type: "string",
        description: "The type of agent to use: explore, general, review"
      },
      prompt: {
        type: "string",
        description: "Detailed task description for the subagent"
      },
    },
    required: ["agent_type", "prompt"]
  }
}
```

## 实现步骤

### Phase 1: Agent 注册表

**文件**: `src/agent/agent.ts`
- `AgentInfo` 接口定义
- `AgentRegistry` 类
- 注册内置 agents：`build`（primary）、`explore`、`general`、`review`

### Phase 2: Subagent 调度器（fork 模式）

**文件**: `src/agent/subagent.ts`
- `SubagentDispatcher` 类
- `fork()` 方法：创建新 AgentLoop，传入 subagent 的 systemPrompt + prompt，执行到返回文本
- 每次 fork 都是全新的上下文（不保留历史）

### Phase 3: dispatch_subagent Tool

**文件**: `src/tool/task.ts`
- 实现 `DispatchSubagentTool`
- 通过 `SubagentDispatcher.fork()` 执行
- 返回结果文本给 Primary Agent

### Phase 4: Subagent Prompts

**文件**: `src/agent/prompt/explore.txt`
- 研究型 subagent prompt
- 专注于搜索、分析、总结

**文件**: `src/agent/prompt/review.txt`
- 审查型 subagent prompt
- 专注于发现问题、逻辑验证

### Phase 5: 集成到 CLI

- `AgentRegistry` 注册所有 agents
- `SubagentDispatcher` 创建
- `DispatchSubagentTool` 注册到 Primary 的 toolRegistry
- 测试：Primary 派发 explore subagent 搜索信息

### Phase 6: NPC Subagent 预留设计（不实现）

NPC Subagent 的 spawn 模式需要：
- 持久化的 session 存储（Map<sessionId, ChatCompletionMessageParam[]>）
- GM Agent 可以通过 sessionId 引用已有 NPC
- NPC 的 system prompt 包含角色设定和应知信息
- 向 NPC 发消息时，在其已有上下文基础上继续对话

```typescript
// 伪代码 - 未来实现
const npcSessionId = await dispatcher.spawn("npc", {
  name: "店主老王",
  systemPrompt: "你是老王，一家杂货店的老板...",
  knowledge: ["店里有三把钥匙", "昨晚听到了奇怪的声音"]
})

// 玩家和 NPC 对话
const reply = await dispatcher.send(npcSessionId, "老板，昨晚发生了什么？")
```

NPC Subagent 的 `send()` 会：
1. 找到 sessionId 对应的消息历史
2. 追加新的 user message
3. 用 AgentLoop 继续对话（保留之前的上下文）
4. 返回 NPC 的回复

这与 fork 模式的关键区别：**fork 是无状态的一次性执行，spawn 是有状态的持续对话**。

## 关键设计决策

1. **Agent 与 Tool 分离**：AgentRegistry 管理 agent 定义，ToolRegistry 管理工具。dispatch_subagent 是一个 tool，但内部通过 SubagentDispatcher 调度 agent。
2. **fork 优先实现**：v0 阶段只实现 fork 模式，满足 Explore/General/Review 需求。
3. **NPC 预留接口**：SubagentDispatcher 的 spawn/send 接口先定义，实现留到 NPC 阶段。
4. **上下文隔离**：subagent 拿不到 Primary 的完整历史，只看到传入的 prompt。
5. **工具共享**：subagent 可以有自己的 ToolRegistry（比如 explore 只需要 read/glob/grep）。

## 验证方式

1. `bun run check` 全部通过
2. CLI 中输入需要探索的任务，Primary 自动派发 explore subagent
3. subagent 返回结果后，Primary 整合回复用户
4. 测试 fork 模式：独立上下文、结果正确返回
5. 测试未知 agent type 的错误处理

## 参考文件

- `references/opencode/packages/opencode/src/tool/task.ts` - TaskTool 完整实现
- `references/opencode/packages/opencode/src/tool/task.txt` - TaskTool 用户描述
- `references/opencode/packages/opencode/src/agent/agent.ts` - Agent 定义和注册
- `references/opencode/packages/opencode/src/agent/prompt/explore.txt` - Explore prompt
