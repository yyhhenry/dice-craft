# EXP: All-Primary — 主模型全权接管交互

> ⚠️ 实验性分支，有破坏性更改，可能不会合并到 main。目的是作为对比验证架构方向。
> 实际上因为只是大作业，发现这么做更有效之后直接合并了。

## 设计动机

当前架构中 NPC 有自己的 message tool，独立决定何时说话、说什么。这导致：
- NPC spawn 时立刻发消息（double-greeting）
- NPC 发消息时机不受 GM 控制（可能打断叙事节奏）
- 语音生成由 GM 负责，但 NPC 文本由 NPC 自己发——两者不同步
- `expect_reply` 语义模糊，NPC 有时不该回复却回复了

## 新架构

**主模型（GM/Builder）全权控制所有用户可见的输出。** NPC agent 仅作为"角色大脑"——维持记忆和信息隔离，但不直接与用户交互。

```
用户消息 → 主模型处理
                │
                ├─ 需要 NPC 参与 → notify(NPC) → NPC 返回想法/台词（不可见）
                │                                → 主模型决定如何呈现（message/voice_speak）
                │
                └─ 不需要 NPC → 主模型直接处理
```

### NPC 的角色变化

| | 现在 | 实验 |
|--|------|------|
| 消息发送 | NPC 调 message tool | NPC 不能发消息，返回文本给 GM |
| 语音 | GM 单独调 voice_speak | GM 统一处理消息+语音 |
| 可见性 | NPC 直接写入 chat | 主模型代为写入 |
| 控制权 | NPC 自主决定 | GM 全权决定 |
| 持久性 | 保持 | 保持（记忆隔离不变） |
| 信息隔离 | 保持 | 保持（NPC 只看到 notify 的内容） |

### notify 变化

```ts
// 现在：notify 是 fire-and-forget 或 wait
notify(content, targets: [{ session_id, expect_reply }])
→ NPC 自己发消息到 chat

// 实验：notify 总是同步返回 NPC 的回应文本
notify(content, targets: [{ session_id }])
→ 返回 { responses: [{ session_id, character_name, content }] }
→ GM 决定是否/如何转发给用户（message + voice_speak）
```

---

## 需要修改的地方

### 后端

| 文件 | 改动 |
|------|------|
| `src/agent/prompt/npc.txt` | 改为"返回你的回应文本，不要调用任何工具" |
| `src/app.ts` | NPC registry 不注册 message tool |
| `src/agent/subagent.ts` | `send()` 总是同步等待 + 返回 NPC 的文本内容 |
| `src/tool/notify.ts` | 去掉 `expect_reply`，返回 NPC 回应数组 |
| `src/agent/prompt/builder.txt` | 更新 NPC 交互说明 |

### 前端

无需改动——消息仍然通过 ChatManager 走 WebSocket 推送，只是 sender 变为 GM 代发。

### 不变的部分

- NPC session 持久化（记忆保留）
- spawn_subagent / dismiss_npc 工具
- SceneCharacter 关联 sessionId
- 信息隔离（NPC 只看到 notify 传入的内容）

---

## 优势

- 消除 double-greeting（NPC 不再能自己发消息）
- GM 完全控制叙事节奏（何时让 NPC 说话、说多少）
- 语音和文本天然同步（GM 一次调用 message + voice_speak）
- notify 语义简单（总是同步返回，GM 处理结果）

## 劣势

- 主模型负担更重（需要转述 NPC 台词）
- 失去 NPC 的"自发性"（所有互动都要经过 GM 中转）
- 主模型 context 变大（NPC 回应文本会进入 GM 的 history）
- 并行多 NPC 回应可能导致主模型输出很长

---

## 实施步骤

1. NPC prompt 改为纯文本返回模式（不调工具）
2. NPC registry 移除 message tool
3. `SubagentDispatcher.send()` 改为同步返回 NPC 文本
4. `notify` tool 返回所有 NPC 的回应内容
5. Builder prompt 更新：GM 负责代 NPC 发消息
6. 测试对比效果
