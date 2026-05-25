# v0 全量代码审查 & 修复计划

> 日期：2026-05-25
> 在开始 WebUI 接入前，对当前后端代码做一次全面梳理。

---

## 1. 新增 General Subagent

**现状：** builder prompt 和 `spawn_subagent` tool description 中引用了 `general` agent 类型，但 `AgentRegistry` 中只注册了 builder/explore/review/npc。LLM 尝试 spawn general 会报错。

**改法：**

- 在 `src/agent/registry.ts` 中新增 `general` agent，mode 为 `subagent`
- 新增 `src/agent/prompt/general.txt`，定位为通用 subagent：可执行 bash、读写文件、做具体工作（区别于 explore 只读、review 只读）
- `task.ts` description 中的 agent_type 列表已经包含 general，无需改
- builder prompt 中已经有对 General 的描述（"General for detail work"），对齐即可

**Prompt 要点：**

```
You are a General subagent. You handle concrete implementation tasks delegated by the primary agent.

Capabilities: read/write/edit files, bash execution, search.
Output: Return your results as text. The primary agent will decide what to show the user.
```

---

## 2. Tool Call Arguments 解析：去掉流式拼接，改为非流式调用

**现状：** `OpenAIModel.chat()` 使用 `stream: true`，逐 chunk 拼接 tool call arguments。但 OpenAI streaming 下 `tc.function.arguments` 是增量 JSON 片段，当前代码每个 chunk 都尝试 `JSON.parse` 并覆盖 —— 只要参数跨 chunk 就会 parse fail 导致 `arguments: {}`。

**分析：** 当前场景（CLI、后续 WebUI）对 agent loop 内部的 tool call 不需要流式展示。真正需要流式的是 `message` tool 的结果推送给前端，那是 ChatManager 层面的事。agent 的 think→tool call 循环完全可以用非流式。

**改法：**

- `chat()` 方法改为 `stream: false`，直接拿完整 response
- 保留 `StreamCallbacks` 接口和 `onToken` 回调签名，但先标记为 deprecated / 暂不使用
- 后续 WebUI 如需流式推送 agent 文本输出，在更上层处理（通过 `onResponse` 回调 + SSE），不在 model 层做

这是目前最简单的修法，避免需要手写 argument buffer + 边界判断。

---

## 3. 修正 builder prompt 中 `sender_name` 的描述

**现状：** `message` tool 的 JSON schema 把 `sender_name` 标为 `required`，但 builder prompt 写 "GM can omit to use default"。两者矛盾。

**改法：**

- schema 保持 `required: ["content", "sender_name"]` 不变
- 修改 builder prompt，明确 GM 也必须填 `sender_name`（填 "GM" 或 "Dice Agent" 即可）
- 修改 `message` tool 的 `sender_name` description，去掉 "GM can omit" 的说法，改为 "Your display name. Set to your character/role name."

---

## 4. 修复 `parentSessionId` 未传递

**现状：** `createSpawnSubagentTool` 调用 `dispatcher.spawn(agentType, prompt, { background, visible })` 时没传 `parentSessionId`。导致所有 spawn 出来的 subagent 的 session 没有 parent 关联，`listSubagents()` 永远返回空。

**改法：**

- `createSpawnSubagentTool` 接收 `sessionRef: { id: string }` 参数（和 message tool 一样的 pattern）
- 调用时传入：`dispatcher.spawn(agentType, prompt, { background }, sessionRef.id)`
- `app.ts` 中 `createSpawnSubagentTool(dispatcher)` 改为 `createSpawnSubagentTool(dispatcher, sessionRef)`

---

## 5. 简化 spawn_subagent：移除 visible 选项

**现状：** `SpawnOptions.visible` 定义了接口、tool schema 有参数、execute 有读取，但 `spawn()` 方法中从未实现。

**改法：**

- 从 `SpawnOptions` interface 中删除 `visible`
- 从 `task.ts` 的 parameters schema 中删除 `visible` 属性
- `spawn()` 只有两条路径：`background: true`（立即返回 sessionId）和 `background: false`（等待完成并返回结果）

设计意图保持简洁：
- `background: false`（默认）= 等 subagent 跑完，拿到结果
- `background: true` = 发出去不等，后续通过 notify 交互

---

## 6. Foreground spawn 返回 subagent 结果 + Background 通知 primary

**6a: Foreground 返回结果**

**现状：** `spawn()` 的 foreground 路径已经 `await loop.waitForIdle()`，但最终 `return { content: "", sessionId }`，结果丢了。

**改法：**

```typescript
// foreground path
loop.receiveMessage(prompt)
await loop.waitForIdle()
const history = loop.getHistory()
this.persistHistory(session.id, history)

// 从 history 中提取最后一条 assistant 文本作为结果
const lastAssistant = history.filter(m => m.role === "assistant" && m.content).pop()
const content = (lastAssistant?.content as string) ?? ""
return { content, sessionId: session.id }
```

`task.ts` 中 foreground 返回时把 `result.content` 交给 builder：

```typescript
return { content: result.content || `Subagent ${agentType} completed (sessionId: ${result.sessionId})` }
```

**6b: Background subagent 完成后通知 primary**

Background NPC 的信息回传已经通过 `message` tool 实现了（NPC 调用 message → ChatManager → onMessage 回调 → primary 的 event 注入）。这条路径是完整的。

但对于 background explore/review（它们没有 message tool），完成后 primary 拿不到结果。需要新增机制：

**改法：**

- `spawn()` background 路径中，在 `waitForIdle` 完成后，向 primary agent 注入一个 event：

```typescript
if (options.background) {
  loop.receiveMessage(prompt)
  // 异步等完成后通知 primary
  loop.waitForIdle().then(() => {
    this.persistLoopHistory(session.id, loop)
    const history = loop.getHistory()
    const lastAssistant = history.filter(m => m.role === "assistant" && m.content).pop()
    const content = (lastAssistant?.content as string) ?? "(no output)"
    if (this.onSubagentDone) {
      this.onSubagentDone(session.id, agentName, content)
    }
  })
  return { content: "", sessionId: session.id }
}
```

- `SubagentDispatcher` 新增回调 `onSubagentDone?: (sessionId, agentType, content) => void`
- `app.ts` 中设置该回调，将结果注入 primary agent 的 event queue：

```typescript
dispatcher.onSubagentDone = (sessionId, agentType, content) => {
  primaryAgent.injectEvent("subagent_done", `<subagent type="${agentType}" session="${sessionId}">\n${content}\n</subagent>`)
}
```

---

## 7. 删除 `maxTokens` 死配置

**现状：** `ModelConfig.maxTokens` 定义了但从未传入 API。

**改法：** 从 `ModelConfig` interface 中删除 `maxTokens` 字段。如果后续需要，再加回来并实际使用。

---

## 8. History 持久化改为增量 append — 本阶段不做

> 后续必要性高：WebUI 场景下对话频繁，全量重写的 I/O 开销随 history 增长线性上升。

**现状：** 每次用户发消息后，`index.ts` 中 `clearMessages` + 逐条 `appendMessage` 全量重写。`appendMessage` 每次还要读 info.json → 改 messageCount → 写 info.json。

**后续改法：**

- 改为只 append 新增的消息，不 clear 重写
- 记录上次持久化位置，只 append `history.slice(lastPersistedIndex)`
- `appendMessages(sessionId, messages[])` 批量版本：一次写入、一次更新 info.json

---

## 9. Session 列举加索引 — 本阶段不做

> 后续必要性高：WebUI 的 session 列表接口会频繁调用，O(n) 全扫在 session 积累后成为瓶颈。

**现状：** `listWorkspaceSessions()` 遍历所有 session 目录逐个读 info.json 判断 workspaceId。

**后续改法：**

- `SessionStore` 维护 `data/sessions/_index.json`，结构为 `{ [workspaceId]: sessionId[] }`
- `create` / `delete` 时同步更新索引
- `listWorkspaceSessions` 直接读索引文件，O(1)
- 启动时如果索引不存在或损坏，扫描一次重建

---

## 10. NPC identity 注册：是否保留？

**现状：** `setupLoop` 中注册了 identity（`{ id: ctx.sessionId, name: "npc", role: "npc" }`）。`ChatManager.sendMessage()` 中 identity 提供 fallback：`senderName: opts.senderName ?? identity?.name ?? "agent"`。但如果 #3 已经让 `sender_name` 变成 required 且 LLM 每次都填，那 identity 的 name fallback 永远不会触发。identity 唯一剩余的作用是提供 `senderRole` fallback，但这个也已经在 `createMessageTool` 中硬编码传入了。

**结论：当前 identity 注册是死代码。**

### 方案分析

**方案 A：去掉 identity 注册，sender_name 保持 required**

- 删除 `chatManager.registerIdentity()` 调用和整个 identity 系统
- 每条消息自描述：sender_name、senderRole 全从 createMessageTool 的参数和 LLM 的 tool call 参数获得
- 前端需要"这个 session 里有哪些角色"时，扫描 chat.jsonl 中出现过的 `senderName` 集合即可
- 后续如果需要角色元数据（头像、描述、是否可见）：新增 `register_character` tool，primary 用它来声明/管理 NPC 的展示属性，这是一个独立的"角色管理"功能，和消息发送解耦

优点：
- 最简单，当前不需要的代码直接删
- 消息系统纯净：每条消息自带全部信息，不依赖外部状态
- 后续加角色管理时是一个独立 feature，不用在已有 identity 上修修补补

缺点：
- 前端获取角色列表需要扫消息（但 chat.jsonl 本来就要读）
- 后续加角色管理时需要从头设计

**方案 B：保留 identity 注册，sender_name 改回可选**

- identity 作为"默认身份"：NPC spawn 时注册角色名，之后 NPC 调用 message 不传 sender_name，自动用 identity name
- NPC prompt 改为"不需要传 sender_name，系统会自动使用你注册的角色名"
- builder 调 message 时传 sender_name（如 "GM"），NPC 不传

优点：
- NPC 调用 message 时少一个参数，减少 LLM 出错机会
- identity 天然成为"角色注册表"，前端可以直接查询有哪些角色

缺点：
- spawn 时不知道角色名（角色名在 builder 的 prompt 里，不是结构化数据），需要新增参数或延迟注册
- 延迟注册需要在第一条消息时才建立 identity，逻辑复杂
- 如果 NPC 需要变更角色名（剧情变装）要更新 identity，增加状态管理负担
- sender_name 一会 required 一会 optional，LLM 容易混乱（builder 要传，NPC 不要传，但共用同一个 tool schema）
- #3 刚说了让 sender_name 保持 required、统一行为，这里又要分化

### 决定

**选方案 A。**

- 本阶段：删除 identity 注册相关代码（`registerIdentity` 调用、`getIdentity`、`identities` map）
- `sendMessage` 的 fallback 链简化为：`senderName` 必传（因为 message tool 的 sender_name 是 required，CLI 用户消息也显式传了）
- 后续前端阶段：如果需要角色列表/角色管理，作为独立 feature 设计 `register_character` tool

---

## 11. 删除重复测试

**现状：** `tests/agent/loop.test.ts` 有两个同名的 "no system message when systemPrompt is omitted"。

**改法：** 删除其中一个。

---

## ~~12. XML 事件格式 escape~~ — 不做

XML 标签不会被程序解析，只是给模型看的语义标记。模型对 `<` `>` 等字符的理解不受影响，无需 escape。跳过。

---

## 13. `createApp()` 拆分为可复用组件 — 本阶段不做，WebUI 接入时执行

**现状：** `createApp()` 是 CLI 专用的单体组装函数，WebUI 需要的组件（model、registry、dispatcher、ChatManager）全部耦合在一起。

**改法（在 WebUI server 开发时执行）：**

- 提取 `createCoreServices(options)` → 返回 model, agentRegistry, sessionManager, chatManager, dispatcher 等
- `createApp()` 变成 `createCoreServices()` + CLI 专用的 onMessage/REPL 逻辑
- WebUI server 同样调用 `createCoreServices()` + HTTP/WS 层

```typescript
// src/core.ts
export function createCoreServices(options: CoreOptions): CoreServices { ... }

// src/app.ts (CLI)
export function createApp(options): App {
  const core = createCoreServices(options)
  // CLI-specific setup...
}

// src/server.ts (WebUI, 未来)
export function createServer(options): Server {
  const core = createCoreServices(options)
  // HTTP/WS setup...
}
```

---

## 14. Model 实例化方式预留 per-workspace 配置 — 本阶段不做，WebUI 接入时执行

**现状：** 全局唯一 `OpenAIModel` 实例。

**改法（在 WebUI server 开发时执行）：**

- `createCoreServices` 接受 `ModelConfig` 作为参数，不再内部读 env
- `loadConfig()` 提升到调用方（CLI main / Server startup）
- 后续 WebUI 如果需要 per-workspace model 配置，只需在 workspace meta 中存 config、在 createCoreServices 时传入不同 config 即可

现阶段不做 model factory，只做"不把 env 读取藏在深处"。

---

## 执行优先级

| 优先级 | 条目 | 原因 |
|--------|------|------|
| P0 | #2 非流式 | 实际 bug，tool call 参数可能丢失 |
| P0 | #4 parentSessionId | 不修则 session 层级断裂 |
| P0 | #5 + #6 spawn 简化 + 结果回传 | subagent 基本功能不完整 |
| P1 | #1 general subagent | 补全已承诺的能力 |
| P1 | #3 sender_name prompt 修正 | 消除 schema/prompt 矛盾 |
| P1 | #7 删 maxTokens | 一行改动 |
| P1 | #10 删除 identity 系统 | 死代码，简化架构 |
| P1 | #11 删重复测试 | 一行改动 |
| — | ~~#12 XML escape~~ | 不做 |
| 本阶段不做 | #8 增量 append | 后续必要，当前对话量小影响不大 |
| 本阶段不做 | #9 session 索引 | 后续必要，当前 session 数量少影响不大 |
| 本阶段不做 | #13 createApp 拆分 | WebUI 接入时执行 |
| 本阶段不做 | #14 model config 外提 | WebUI 接入时执行 |
