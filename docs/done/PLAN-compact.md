# PLAN: Context Compaction（上下文压缩）

## 背景

对话历史随游玩时间增长会超出模型上下文窗口。需要一种机制在 token 接近上限时，将旧消息压缩为摘要，保留近期原始消息，同时不丢失任何持久化数据。

## 原分支 feat/compact 的问题

1. **Token 估算错误** — `estimateTokens` 直接返回 `JSON.stringify` 的字符数，未做任何字符→token 换算。中文字符在 UTF-8 中占 3 字节，但 JS `.length` 按 UTF-16 code unit 计只得 1，导致中文 token 数被严重低估。
2. **未利用 API 返回的真实 token 数** — 模型每次回复都会返回 `usage.prompt_tokens`，这是最准确的计量，应作为压缩触发的主要依据。
3. **重复计算** — `splitContext`、`estimateTokens` 在多个方法中被重复调用。
4. **默认值不一致** — `AgentConfig.recentTurnsToKeep` 默认 6，`COMPACT_RECENT_USER_TURNS` 常量为 2。
5. **缺少错误处理** — 摘要请求失败时会抛异常中断整个 agent loop。
6. **Compact 状态与消息分离** — CompactState 仅存于内存，session 恢复时无法重建压缩状态。

## 参考：opencode 的设计

- **触发机制**：基于 API 返回的真实 token 用量（`input + output + cache.read + cache.write`）与模型可用上下文（`context - maxOutput`）比较。估算只用于决定保留多少 recent tail。
- **Token 估算**：`string.length / 4`（即 chars/4）。但 opencode 主要是英文场景。
- **Prune 机制**：先裁剪旧 tool output（保留调用信息但截断大输出），再做完整压缩。
- **Summary 存储**：压缩结果作为特殊的 assistant message（`summary: true`）持久化在消息流中。
- **Tail selection**：不是固定 N 个 turn，而是基于 token budget 动态选择保留多少 recent messages。
- **Anchored summary**：重复压缩时将上次摘要作为 `<previous-summary>` 传入，要求模型"更新"而非重写。

## 修复后设计

### 核心原则

- **Raw history 不可变**：`savedHistory` 始终保存完整对话历史，用于持久化和恢复。
- **Model context 按需构建**：每次调用模型前，根据当前状态构建压缩后的消息序列。
- **双重触发**：
  - **主要**：使用 API 返回的 `usage.prompt_tokens` 与阈值比较，判断是否触发压缩。
  - **辅助**：新消息加入前用 bytes/4 预估，提前判断是否需要压缩（避免下次请求溢出）。
- **Compact 状态持久化**：压缩摘要作为特殊消息存储在历史中，session 恢复时可自动重建。

### Token 估算

```ts
function estimateBytes(text: string): number {
  return new TextEncoder().encode(text).length
}

function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4)
}
```

**为什么是 bytes/4**：
- 英文：1 char = 1 byte ≈ 0.25 token → bytes/4 正确
- 中文：1 char = 3 bytes → bytes/4 ≈ 0.75 token/字。MiMo 采用 Qwen 词表，内置完整中文字典，单个汉字几乎都是 1 token，且大量常见词语被编码为单 token，所以 0.75 token/字 是一个略保守但精度相当高的估计值。
- chars/4 对中文严重低估（1 char / 4 = 0.25 token，实际为 ~1 token/字）

**增量计算优化**：对整个历史做 `TextEncoder().encode(JSON.stringify(...))` 开销大。采用增量前缀和：

```ts
class TokenEstimator {
  private knownBytes = 0     // 已计算的消息字节数
  private knownCount = 0     // 已计算的消息条数

  /** 追加新消息后更新估算值（只编码新增部分） */
  update(messages: ChatCompletionMessageParam[]): number {
    if (messages.length > this.knownCount) {
      const newMessages = messages.slice(this.knownCount)
      for (const msg of newMessages) {
        this.knownBytes += estimateBytes(JSON.stringify(msg))
      }
      this.knownCount = messages.length
    }
    return Math.ceil(this.knownBytes / 4)
  }

  /** 压缩后重置（compact marker 替换了旧消息） */
  reset() {
    this.knownBytes = 0
    this.knownCount = 0
  }

  get tokens(): number {
    return Math.ceil(this.knownBytes / 4)
  }
}
```

每次 `run()` 只对新追加的消息（user message、assistant response、tool results）计算字节数并累加，避免重复编码整个历史。压缩后 reset 重新计算（此时消息数已大幅减少）。

估算用于：分割 tail 时计算 recent messages 的大小、UI 展示、辅助触发判断。**触发压缩的主要依据仍是 API 返回的真实 token 数。**

### 架构

```
AgentLoop
├── savedHistory: Message[]              // 完整原始历史（持久化用）
├── compactState: CompactState | null    // 运行时压缩状态（可从历史重建）
│   ├── summary: string                  // 压缩摘要文本
│   └── compactedUpTo: number            // 已压缩到的消息索引
├── estimator: TokenEstimator            // 增量 token 估算器
├── lastPromptTokens: number | null      // 上次 API 返回的 prompt_tokens
├── config
│   ├── contextWindowTokens: number      // 模型上下文窗口大小
│   └── recentTurnsToKeep: number        // 保留的最近 user turn 数
└── methods
    ├── buildModelContext(raw) → Message[]
    ├── splitMessages(raw) → {old, recent} | null
    ├── summarize(old, prevSummary?) → string
    ├── shouldCompact() → boolean           // 基于 lastPromptTokens 判断
    └── getContextUsage() → ContextUsage
```

### 压缩触发逻辑

```ts
// 阈值 = contextWindow × 0.8（留 20% 给输出和新消息）
const threshold = contextWindowTokens * 0.8

// 主要触发：API 返回的真实 prompt_tokens
function shouldCompact(): boolean {
  if (!this.lastPromptTokens) return false
  return this.lastPromptTokens >= threshold
}

// 辅助触发：增量估算器的累计值
function shouldCompactEstimate(): boolean {
  return this.estimator.tokens >= threshold
}
```

每次模型调用返回后更新 `lastPromptTokens`。如果触发，在下次调用模型前执行压缩。

### 消息分割

```ts
splitMessages(messages: Message[]): { old: Message[], recent: Message[] } | null {
  // 从后往前找第 recentTurnsToKeep 个 user message 的位置
  let userTurnsSeen = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userTurnsSeen++
      if (userTurnsSeen === this.recentTurnsToKeep) {
        return { old: messages.slice(0, i), recent: messages.slice(i) }
      }
    }
  }
  return null  // 消息太少，无法分割
}
```

### Compact 状态持久化

在 `savedHistory` 中插入一条特殊格式的 system message 来标记压缩点：

```ts
interface CompactMarker {
  role: "system"
  content: string  // summary 文本
  _compact: {
    version: 1
    compactedUpTo: number  // 此 marker 之前被压缩的原始消息数
    createdAt: string      // ISO timestamp
  }
}
```

**恢复流程**：`setHistory()` 时扫描历史中的 compact marker，重建 `compactState`。

**好处**：
- Compact 状态自然随 session history 持久化（JSONL）
- 不需要额外的存储机制
- Session 恢复时自动获得压缩状态

### buildModelContext 流程

```
1. 检查是否需要压缩（shouldCompact 或 shouldCompactEstimate）
2. if 不需要 → 直接返回 savedHistory
3. splitMessages(savedHistory) → {old, recent}
4. if compactState 存在且覆盖了所有 old messages → 直接复用
5. else → 调用 summarize(old, compactState?.summary)
   - 将旧 summary 作为上下文传入（不丢失更早信息）
   - 生成新的完整摘要（不是"合并"，而是"基于旧摘要 + 新消息生成完整摘要"）
6. 更新 compactState，在 savedHistory 中插入/更新 compact marker
7. 返回 [summarySystemMessage, ...recent]
```

### 摘要生成

System prompt（参考 opencode 的 compaction agent）:

```
You are a context summarization assistant for a tabletop RPG gaming session.

Summarize the conversation history you are given. The newest turns are kept
verbatim outside your summary, so focus on the older context that still
matters for continuing the game.

If the prompt includes a <previous-summary> block, treat it as the anchor.
Generate a comprehensive updated summary that includes all still-relevant
information from the previous summary AND the new context. Do not lose any
important details from the previous summary.

Follow the exact output structure requested. Keep every section.
Preserve exact names, IDs, locations, rules, numbers, and game state.
Prefer terse bullets over prose paragraphs.
Do not mention that you are summarizing or compacting.
Respond in the same language as the conversation.
```

User prompt 要求的输出结构（针对游戏场景）:

```
## 当前目标
- [当前游戏/对话的主要目标]

## 游戏规则与约束
- [已建立的规则、限制、偏好设定]

## 世界与场景状态
- [地点、物品、环境、时间线]

## 角色与关系
- [NPC、玩家角色、关系、状态]

## 重要事件与决策
- [已发生的关键事件、做出的重要决策]

## 进行中的事项
- [未完成的任务、悬而未决的问题]

## 关键上下文
- [技术细节、错误信息、需要记住的具体数值]
```

**错误处理**：
- 摘要请求失败 → 保留上次摘要（如有），标记需要重试
- 如果无历史摘要且失败 → 跳过压缩，下次再试（不中断 agent loop）
- 记录日志，UI 可选择显示压缩失败状态

### 配置

| 配置项 | 来源 | 默认值 |
|--------|------|--------|
| `contextWindowTokens` | Workspace config（用户设置） | 1,000,000 |
| `compactThresholdRatio` | 内部常量 | 0.8 |
| `recentTurnsToKeep` | 内部常量 | 4 |

### ContextUsage Schema（前端展示）

```ts
interface ContextUsage {
  // 当前上下文 token 数（优先用 API 返回值，fallback 用 bytes/4 估算）
  tokens: number
  // 压缩触发阈值
  thresholdTokens: number
  // tokens / thresholdTokens * 100（0-100+）
  percent: number
  // 是否已触发过压缩
  compacted: boolean
  // 已压缩的消息条数
  compactedMessageCount: number
}
```

### WebSocket 状态推送

- 在 `onStatusChange` 回调中附带 `contextUsage`
- Agent 发消息时也推送一次（提高响应感）
- 格式：`{ type: "status", payload: { primaryActive, npcCount, contextUsage } }`

### Subagent 支持

SubagentDispatcher 创建 AgentLoop 时传入相同的 compact 配置。NPC 对话也能自动压缩。

### UI 组件（采纳原分支设计）

ChatPanel 底部显示 context usage 指示器：
- 进度条（14×1.5px）+ 百分比数字
- 颜色分级：<70% 灰色 / 70-90% 琥珀色 / ≥90% 红色 / 已压缩时天蓝色
- 已压缩时显示 "COMPACT" 小标签
- Tooltip 展示详细信息（token 数、阈值、压缩消息数）
- 使用 lucide `Gauge` 图标

### Workspace Settings（采纳原分支设计）

增加 "Context Window Tokens" 数字输入框：
- 默认值 1,000,000
- 提示文字："Compaction starts at 80% of this value."
- 存入 workspace config 的 `contextWindowTokens` 字段

---

## 实现步骤

### Phase 1: 核心压缩逻辑

1. `src/shared/schemas.ts`：
   - `WorkspaceConfigSchema` 增加 `contextWindowTokens` 字段
   - 新增 `ContextUsageSchema`
   - 导出相关常量（`DEFAULT_CONTEXT_WINDOW_TOKENS`、`COMPACT_THRESHOLD_RATIO`）

2. `src/agent/loop.ts`：
   - AgentConfig 增加 `contextWindowTokens`、`recentTurnsToKeep`
   - 新增 `TokenEstimator` 类（增量前缀和，bytes/4）
   - 实现 `splitMessages`
   - 实现 `summarize`（含 previous-summary 注入、错误处理）
   - 实现 `buildModelContext`（含 compact marker 插入）
   - 修改 `run()` 方法：
     - 使用 `buildModelContext` 构建发送消息
     - 每次追加消息时调用 `estimator.update()` 增量计算
     - 记录 API 返回的 `usage.prompt_tokens` 到 `lastPromptTokens`
     - 每轮结束后检查 `shouldCompact()`
   - 实现 `setHistory()` 重建 compactState + 重置 estimator
   - 实现 `getContextUsage()`

3. `tests/agent/compact.test.ts`：
   - 低于阈值不触发压缩
   - 超过阈值（usage-based）触发压缩
   - 预估触发（bytes/4）
   - 验证模型收到的消息结构（summary system msg + recent messages）
   - compact marker 正确插入 savedHistory
   - setHistory 恢复 compactState
   - 摘要生成时 previous-summary 被正确传入
   - 摘要失败时 fallback 行为
   - raw history 始终完整（compact marker 除外不改变原始消息）

### Phase 2: 集成与传播

4. `src/app.ts`：传递 `contextWindowTokens` 和 `recentTurnsToKeep`

5. `src/agent/subagent.ts`：SubagentDispatcher 接收并传递 compact 配置

6. `src/server/app-pool.ts`：从 workspace config 读取 `contextWindowTokens`

### Phase 3: WebSocket & 前端

7. `src/server/ws.ts`：status 消息包含 contextUsage

8. 前端 `useWebSocket.ts`：AgentStatus 增加 contextUsage 字段

9. 新增 `ContextUsage.tsx` 组件（采纳原分支实现）

10. `WorkspaceSettings.tsx`：增加 context window 输入（采纳原分支实现）

11. `ChatPanel.tsx`：展示 ContextUsage 组件

### Phase 4: 验证

12. `bun run check` 通过
13. 手动测试：长对话触发压缩，验证 UI 显示和对话连贯性

---

## 补充：CompactState 文件持久化

### 问题

当前实现中 `compactState` 是纯内存状态。服务器重启后 `setHistory()` 加载全量 raw messages 并将 `compactState` 重置为 null。下次触发 compact 时 `summarize()` 会把所有旧消息（可能远超模型上下文）塞进一个 API 请求，导致失败。

### 方案

独立文件 `data/sessions/<id>/compact-state.json` 存储：

```json
{
  "summary": "...",
  "compactedUpTo": 32
}
```

### 实现

1. `src/agent/loop.ts`：导出 `CompactState`，新增 `getCompactState()` / `restoreCompactState()`
2. `src/session/store.ts`：新增 `readCompactState()` / `writeCompactState()`
3. `src/session/manager.ts`：透传方法
4. `src/server/app-pool.ts`：加载 session 时恢复 compact state
5. `src/server/ws.ts`：`waitForIdle` 保存 history 时同步保存 compact state
