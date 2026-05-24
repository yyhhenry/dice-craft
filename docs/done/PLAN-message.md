# Chat Message 系统设计计划

> **Status: COMPLETED** — 已实现。ChatManager、message/notify 工具、receiveMessage 抽象、CLI 适配均已完成。

## 核心思路

把对话抽象成 IM 聊天。Agent 的中间思考、tool call 对用户不可见（只在模型上下文内），模型通过 `message` 工具主动发送消息给用户。一条用户输入可以触发模型发多条消息——有一点进展就先发一条稳住用户。

## 当前 vs 新模型

```
当前：
  用户输入 → [Agent循环: 思考+tool call] → 最终文本 → 直接显示给用户

新模型：
  用户输入 → [Primary Agent循环: 思考+tool call]
                ├── message tool → GM 旁白/系统消息 → chat → 用户看到
                ├── notify tool → 通知 NPC → NPC 自己的 message tool → chat → 用户看到
                └── 内部文本(隐藏)
```

Primary 绝不代替 NPC 说话。NPC 的每条消息都由 NPC 自己的 agent loop 生成。

## Chat 独立抽象

Chat 是独立于 agent 内部消息的抽象。每个 primary session 有且只有一个 chat。
Subagent 没有自己的 chat——它们的消息直接推送到主 session 的 chat 中。

```
Primary Session
├── messages.jsonl    # Agent 内部对话（system/user/assistant/tool），用于上下文恢复
└── chat.jsonl        # 唯一的聊天流，所有人可见

Subagent Session
└── messages.jsonl    # Subagent 内部对话（无 chat.jsonl）
```

消息流向：
- 用户发消息 → 写入主 chat.jsonl
- Primary (GM) 调 message tool → 写入主 chat.jsonl（旁白、系统消息）
- NPC subagent 调 message tool → 写入主 chat.jsonl（NPC 自己说的话）
- Primary 调 notify tool → 不写入 chat，只通知 NPC（NPC 可能回复可能不回复）

## 聊天消息数据结构

```typescript
// src/chat/types.ts

export interface ChatMessage {
  id: string              // "msg_<timestamp>_<uuid6>"
  sessionId: string       // 主 session ID（chat 归属）
  senderId: string        // 发送者 ID
  senderName: string      // 发送者显示名（用于 UI 展示）
  senderRole: SenderRole  // 发送者角色类型
  content: string         // 消息内容
  timestamp: string       // ISO 时间戳
}

export type SenderRole = "user" | "agent" | "npc" | "system"

// 发送者身份定义
export interface SenderIdentity {
  id: string              // 唯一标识
  name: string            // 显示名
  role: SenderRole        // 角色类型
  color?: string          // UI 颜色（可选，前端用）
}
```

存储路径：`data/sessions/<primarySessionId>/chat.jsonl`

## 两个工具：message（说话）+ notify（通知 NPC）

Primary (GM) 绝不代替 NPC 说话。两个职责分开：

- **message tool**：发消息到 chat（所有 agent 可用，各自用自己的身份）
- **notify tool**：primary 专用，通知 NPC 信息 / 转发用户消息，不写入 chat

### Message 工具（所有 agent 可用）

```typescript
// src/tool/message.ts

interface MessageToolArgs {
  content: string       // 消息内容
  sender_name?: string  // 发送者显示名（由 agent 身份决定，通常不需要传）
}
```

调用者身份由运行上下文决定，不可伪造：
- Primary agent 调用 → sender_role 固定为 "agent"（GM 旁白、系统消息）
- NPC subagent 调用 → sender_role 固定为 "npc"，sender_name 由注册身份决定

```json
// Primary (GM) 说话
{"content": "你走进酒馆，空气中弥漫着麦酒的香气"}

// NPC subagent 说话（酒馆老板的 agent loop 里调用）
{"content": "欢迎冒险者！想喝点什么？"}
```

### Notify 工具（Primary 专用）

```typescript
// src/tool/notify.ts

interface NotifyToolArgs {
  content: string            // 通知内容（用户的话 / GM 指令 / 场景描述）
  targets: NotifyTarget[]    // 通知目标
}

interface NotifyTarget {
  session_id: string         // NPC subagent session ID
  expect_reply?: boolean     // 是否要求 NPC 回复（默认 false）
}
```

Notify 不写入 chat，只发给 NPC 的 agent loop。NPC 收到后：
- `expect_reply: true` → NPC 处理后调用自己的 message tool 回复
- `expect_reply: false` → NPC 只更新上下文，不说话

```json
// 转发用户消息给酒馆老板，要求回复
{
  "content": "老板，最近有什么新闻吗",
  "targets": [{"session_id": "npc_tavern_keeper", "expect_reply": true}]
}

// 通知老人 NPC 场景信息，不要求回复
{
  "content": "有人在酒馆提到了北边的龙",
  "targets": [{"session_id": "npc_old_man", "expect_reply": false}]
}

// 同时通知多个 NPC
{
  "content": "冒险者大声宣布要挑战所有人",
  "targets": [
    {"session_id": "npc_tavern_keeper", "expect_reply": false},
    {"session_id": "npc_warrior", "expect_reply": true}
  ]
}
```

### 信息隔离示例

```
用户: "我想跟酒馆老板聊聊"

Primary (GM) 的处理：
1. message: "你走向吧台"（GM 旁白，写入 chat）
2. notify: 发给酒馆老板（expect_reply: true）
3. 不通知老人 NPC（已离开场景）

酒馆老板 NPC 收到通知后：
→ message: "欢迎！最近听说北边山洞有条龙"（NPC 自己说话，写入 chat）

Primary 看到 NPC 说了话，决定：
4. message: "你注意到角落里的老人竖起了耳朵"（GM 旁白）
5. notify: 发给老人 NPC（expect_reply: false）"有人提到了北边的龙"
→ 老人更新上下文，不说话
```

## Chat Manager

```typescript
// src/chat/manager.ts

class ChatManager {
  private baseDir: string           // data/
  private identities: Map<string, SenderIdentity>  // 已注册的身份

  // 注册身份（agent 启动时注册自己，NPC 创建时注册）
  registerIdentity(identity: SenderIdentity): void

  // 发送消息到主 session 的 chat（无论调用者是 primary 还是 subagent）
  sendMessage(primarySessionId: string, opts: {
    content: string
    senderId?: string
    senderName?: string
    senderRole?: SenderRole
  }): ChatMessage

  // 读取主 session 的聊天记录
  getMessages(primarySessionId: string): ChatMessage[]

  // 获取最近 N 条消息（用于恢复上下文）
  getRecentMessages(primarySessionId: string, count: number): ChatMessage[]
}
```

所有角色发消息都通过 `sendMessage(primarySessionId, ...)`，写入主 session 的 `chat.jsonl`。

### 持久化结构

```
data/sessions/<primarySessionId>/
├── info.json           # Session 元信息（已有）
├── messages.jsonl      # Primary agent 内部消息（已有）
└── chat.jsonl          # 聊天消息流（新增，所有人可见）

data/sessions/<subagentSessionId>/
├── info.json           # Session 元信息（已有）
└── messages.jsonl      # Subagent 内部消息（已有，无 chat.jsonl）
```

`chat.jsonl` 每行一个 `ChatMessage` JSON：
```jsonl
{"id":"msg_001","sessionId":"sess_primary","senderId":"user","senderName":"玩家","senderRole":"user","content":"帮我写个贪吃蛇","timestamp":"2026-05-24T10:00:00Z"}
{"id":"msg_002","sessionId":"sess_primary","senderId":"agent","senderName":"DiceCraft","senderRole":"agent","content":"好的，我来看看需要什么","timestamp":"2026-05-24T10:00:01Z"}
{"id":"msg_003","sessionId":"sess_primary","senderId":"npc_01","senderName":"酒馆老板","senderRole":"npc","content":"欢迎来到冒险酒馆！","timestamp":"2026-05-24T10:00:03Z"}
```

## 消息注入机制（基于现有 Agent Loop）

现有 `AgentLoop` 已有 `injectEvent(source, content)` + `flushEvents()` 机制，
事件以 `<event source="...">...</event>` XML 格式注入到 tool call 之后。

这个机制直接复用，作为 chat 消息注入 primary agent 上下文的方式。

### 用户消息的两条路径

```
Primary Agent 空闲（没有在跑 loop）：
  用户输入 → 作为 run() 的 userMessage 参数
  包装格式：<chat sender="user" sender_name="玩家">消息内容</chat>

Primary Agent 忙碌（正在 loop 中执行 tool call）：
  用户输入 → injectEvent("user", "<chat sender=\"user\" sender_name=\"玩家\">消息内容</chat>")
  → flushEvents() 在下一次 tool call 后自动注入
```

### NPC 消息注入

NPC subagent 通过 message tool 发消息后：
1. 写入主 chat.jsonl（持久化 + 展示给用户）
2. 作为 event 注入 primary agent（让 primary 知道 NPC 说了什么，以便后续决策）

```typescript
// NPC subagent 调用 message tool 后的流程：
chatManager.sendMessage(primarySessionId, { content, senderName: "酒馆老板", senderRole: "npc" })
primaryLoop.injectEvent("npc:酒馆老板", `<chat sender="npc" sender_name="酒馆老板">${content}</chat>`)
onMessageCallback(chatMessage)  // 通知 UI
```

Primary 收到 NPC 消息后，可以决定：
- 是否通知其他 NPC（通过 notify tool）
- 是否给用户更多旁白（通过 message tool）
- 是否继续让 NPC 对话（再次 notify）

### XML 格式定义

```xml
<!-- 用户消息 -->
<chat sender="user" sender_name="玩家">我想去酒馆看看</chat>

<!-- Primary agent 自己的消息（message tool 内部用） -->
<chat sender="agent" sender_name="DiceCraft">好的，你来到了一家酒馆</chat>

<!-- NPC 消息 -->
<chat sender="npc" sender_name="酒馆老板" sender_id="npc_01">欢迎冒险者！</chat>

<!-- 系统消息（如游戏事件） -->
<chat sender="system">骰子点数：4</chat>
```

## Agent Loop 改造：receiveMessage 抽象

所有 agent loop（primary + NPC）统一提供 `receiveMessage()` 方法，
内部处理空闲/忙碌状态，调用者不需要关心。

```typescript
// src/agent/loop.ts

class AgentLoop {
  private running = false
  private pendingMessage: string | null = null

  /** 接收一条消息。空闲则启动新轮次，忙碌则注入为 event。 */
  receiveMessage(xmlContent: string): void {
    if (this.running) {
      // 正在 loop 中，注入为 event，下一次 tool call 后 flush
      this.injectEvent("chat", xmlContent)
    } else {
      // 空闲，启动新轮次
      this.pendingMessage = xmlContent
      this.startLoop()
    }
  }

  private async startLoop(): Promise<void> {
    this.running = true
    while (this.pendingMessage) {
      const msg = this.pendingMessage
      this.pendingMessage = null
      await this.run(msg)
    }
    this.running = false
  }

  // run() 现在不返回文本，内部文本不暴露
  async run(userMessage: string): Promise<void> {
    // ... 现有逻辑，但不 return response
    // message tool 发消息通过 onMessage 回调
  }
}
```

关键点：
- `receiveMessage()` 是唯一的消息入口，CLI 和 SubagentDispatcher 都用它
- 空闲时启动新 loop，忙碌时 inject event
- loop 结束后自动检查是否有 pending 消息（用户可能在 agent 忙碌时又发了消息）

## SubagentDispatcher 改造

```typescript
// src/agent/subagent.ts

// 通知单个 NPC
async send(sessionId: string, content: string, expectReply: boolean): Promise<void> {
  const loop = this.activeLoops.get(sessionId)
  if (!loop) throw new Error(`Session not found: ${sessionId}`)
  const chatXml = wrapNotifyXml(content)
  if (expectReply) {
    // 要求回复：等 NPC 完成
    loop.receiveMessage(chatXml)
    await loop.waitForIdle()  // 新增：等待 loop 空闲
  } else {
    // 不要求回复：投递即走
    loop.receiveMessage(chatXml)
  }
}

// 批量通知
async notifyMultiple(targets: NotifyTarget[], content: string): Promise<void> {
  const promises = targets.map(t => this.send(t.session_id, content, t.expect_reply ?? false))
  await Promise.all(promises)
}
```

## CLI 适配

```typescript
// src/index.ts 改动

// CLI 极其简单：用户输入 → receiveMessage，剩下全靠 agent loop 内部处理
async function handleUserInput(input: string) {
  const chatXml = wrapChatXml("user", "玩家", input)
  chatManager.sendMessage(primarySessionId, { content: input, senderRole: "user" })
  primaryLoop.receiveMessage(chatXml)
}

// 效果：
// user$ 我想去酒馆看看
// [DiceCraft] 好的，你来到了一家酒馆
// [酒馆老板] 欢迎冒险者！想喝点什么？
// [DiceCraft] （悄悄告诉你：你可以跟老板聊聊最近的传闻）
// user$ 老板，最近有什么新闻吗
// [酒馆老板] 哦，听说北边的山洞里有条龙...
```

CLI 不负责忙碌检测、不负责转发。所有信息路由由 primary agent 的 tool call 控制。

## Subagent 消息

Subagent 没有自己的 chat。它们通过 message tool 发的消息直接写入主 session 的 chat.jsonl。

```typescript
// spawn subagent 时注册身份
chatManager.registerIdentity({
  id: subagentSessionId,
  name: "酒馆老板",  // NPC 名字
  role: "npc",
})

// Subagent 的 message tool 发消息时：
// - 直接写入主 session 的 chat.jsonl（通过 primarySessionId）
// - 触发主 session 的 onMessage 回调
// - 同时 injectEvent 到 primary agent 让它知道 NPC 说了什么
```

## 需要修改的文件清单

| 文件 | 改动 |
|------|------|
| `src/chat/types.ts` | **新增** ChatMessage, SenderIdentity, SenderRole |
| `src/chat/manager.ts` | **新增** ChatManager：注册身份、发消息、读消息 |
| `src/chat/index.ts` | **新增** 导出 |
| `src/tool/message.ts` | **新增** message tool（所有 agent 可用，写入 chat） |
| `src/tool/notify.ts` | **新增** notify tool（primary 专用，通知 NPC） |
| `src/tool/builtin.ts` | **修改** 注册两个新工具 |
| `src/tool/index.ts` | **修改** 导出 |
| `src/agent/loop.ts` | **修改** 添加 receiveMessage()、onMessage 回调、waitForIdle() |
| `src/agent/subagent.ts` | **修改** send() 适配 notify 语义 |
| `src/app.ts` | **修改** 组装 ChatManager，注入依赖 |
| `src/index.ts` | **修改** CLI 适配：chat 抽象、忙碌检测、onMessage 打印 |

## 实现步骤

### Phase 1: Chat 基础

| 文件 | 内容 |
|------|------|
| `src/chat/types.ts` | ChatMessage, SenderIdentity, SenderRole 类型 |
| `src/chat/manager.ts` | ChatManager：注册身份、发消息、读消息、persist 到 chat.jsonl |
| `src/chat/index.ts` | 导出 |

### Phase 2: Message + Notify 工具

| 文件 | 内容 |
|------|------|
| `src/tool/message.ts` | message tool：写入 chat.jsonl + onMessage 回调 |
| `src/tool/notify.ts` | notify tool：调用 subagentDispatcher.send() 通知 NPC |

message tool 身份由调用者决定（不可伪造）。
notify tool 只有 primary 可用。

### Phase 3: Agent Loop 改造

- 添加 `receiveMessage(xml)` 方法（空闲启动 loop，忙碌 inject event）
- 添加 `waitForIdle()` 方法（供 SubagentDispatcher 等待完成）
- 添加 onMessage 回调参数
- run() 不再返回文本，内部文本不暴露
- 注入 message tool 到 ToolRegistry

### Phase 4: SubagentDispatcher 改造

- send() 用 `loop.receiveMessage()` 替代直接 `loop.run()`
- expect_reply: true → receiveMessage + waitForIdle
- expect_reply: false → receiveMessage 即走
- 新增 notifyMultiple() 批量通知

### Phase 5: CLI 适配

- 用户输入写入 chat.jsonl + `primaryLoop.receiveMessage(xml)`
- onMessage 回调实时打印，带发送者身份前缀
- 无需忙碌检测，全由 loop 内部处理

## 验证方式

1. `bun run check` 全部通过
2. Primary 调 message tool 发 GM 消息，用户实时看到
3. Primary 用 notify 转发用户消息给指定 NPC，NPC 调 message tool 回复
4. Primary 用 notify(expect_reply:false) 通知 NPC，NPC 不说话
5. NPC 之间互不可见（除非 primary 主动通知）
6. Primary 绝不代替 NPC 说话
7. 重启后 chat.jsonl 可恢复聊天记录
