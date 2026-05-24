# DiceCraft Demo v0 — 最小可行计划

> **Status: 已归档** — 早期计划，后续开发方向已调整，不再按此计划推进。部分内容已在其他 plan 中实现，其余不再讨论。

## 目标

先跑起来：CLI版本，能玩一个完整的海龟汤。验证核心Agent循环、Skill机制、NPC Subagent基本可用。

## 简化策略

| 完整方案 | v0简化 | 理由 |
|---------|--------|------|
| Primary Build Agent + 多Subagent | 单GM/Primary Agent，构建端暂不拆分 | 先验证运行时，构建拆分后续加 |
| GM Agent + NPC Subagent | GM合并到Primary，只保留NPC Subagent | 最小角色集合 |
| 多个游戏Skill | 先做1个：海龟汤 | 最简单的隐藏信息游戏 |
| Skill系统 + 脚本引擎 | 纯Skill方式，Skill即prompt+状态管理 | 不需要代码执行引擎 |
| 上下文系统（记忆+可见性+Compact） | 只做基础状态文件，不做Compact和持久化 | 先能跑，再优化 |
| 多模态理解、TTS | 不做 | v0纯文本 |
| React前端 | CLI | 核心逻辑先行 |
| 结构化记忆文件 | 简单JSON状态文件 | 够用就行 |

## 技术选型

- **语言**：Python，uv管理依赖
- **Agent SDK**：Anthropic SDK + OpenAI SDK（均兼容 MiMo API）
- **模型**：MiMo-V2.5-Pro
- **API 配置**：
  - Anthropic: `ANTHROPIC_BASE_URL=https://api.xiaomimimo.com/anthropic`
  - OpenAI: `OPENAI_BASE_URL=https://api.xiaomimimo.com/v1`（仅支持 chat completions，不支持 responses）
  - `MIMO_API_KEY=sk-xxx`（在 .env 文件中配置）
- **项目结构**：新建独立项目目录

## 核心架构（v0）

```
用户 (CLI)
  ↓
GM/Primary Agent（主循环）
  ├── 持有海龟汤的完整设定（谜面、谜底、关键线索）
  ├── 判断玩家提问类型（是/否问题、猜测、无效）
  ├── 决定何时派发NPC Subagent（如果有的话）
  └── 管理游戏状态（已揭示线索、提问历史）
  ↓
NPC Subagent（海龟汤中可选）
  ├── 独立上下文，只知道NPC应知的信息
  └── GM按需派发，结果回传GM整合
```

## 海龟汤 Skill 设计

**输入**：玩家的自然语言发言（提问/猜测/闲聊）

**状态文件**（JSON）：
```json
{
  "puzzle": { "title": "...", "story": "...", "answer": "...", "key_clues": [...] },
  "revealed_clues": [],
  "questions_history": [],
  "status": "playing"
}
```

**GM Agent行为**：
1. 接收玩家输入
2. 判断类型：是/否问题 → 根据谜底回答；猜测 → 判断对错；闲聊 → 引导回游戏
3. 更新状态文件
4. 如果满足条件（猜对/放弃），结束游戏

**NPC Subagent**（可选，如果汤面中有可对话角色）：
- GM将NPC应知的信息注入其system prompt
- 玩家"问NPC"时，GM派发NPC Subagent
- NPC回答后GM整合到主对话中

## 开发步骤

### Step 0：项目初始化
- 新建项目目录（如 `dicecraft/`）
- `uv init`，配置依赖（openai SDK / anthropic SDK）
- 确认MiMo API endpoint和调用方式

### Step 1：Agent循环
- 实现基本的Agent对话循环（CLI stdin/stdout）
- GM Agent system prompt：海龟汤主持人角色
- 硬编码一个海龟汤谜面作为测试数据
- 验证：能正常问答、判断猜测对错

### Step 2：状态管理
- 实现JSON状态文件读写
- Agent每次回答后更新状态（已揭示线索、提问历史）
- 验证：状态正确持久化，不会遗忘已揭示的信息

### Step 3：NPC Subagent
- 实现Subagent派发机制（独立上下文、独立system prompt）
- GM判断"玩家在和NPC说话" → 派发NPC Subagent → 结果回传
- 验证：NPC只知道自己的信息，GM知道全局

### Step 4：Skill封装
- 将海龟汤逻辑封装为一个Skill（定义输入输出、状态结构、prompt模板）
- GM Agent根据加载的Skill切换行为
- 验证：换一个Skill定义就能玩另一个谜题

### Step 5（可选）：前端接入准备
- 将 CLI REPL 替换为 HTTP/WebSocket server（如 Hono / Bun.serve）
- 定义前后端通信协议（消息格式、事件类型）
- Agent 循环输出改为流式推送到前端
- 为前端提供 session/workspace 管理的 API
- 准备前端项目脚手架（React + Vite）

## 验证标准

v0完成时应该能做到：
1. `uv run python main.py` 启动，进入CLI对话
2. 能玩完一局完整的海龟汤（提问 → 回答 → 猜测 → 揭晓）
3. GM能正确维护隐藏状态（不会把谜底泄露给玩家）
4. 如果有NPC，NPC只知道自己该知道的
5. 游戏结束后可以再开一局

## 后续扩展（不在v0范围）

- [ ] Primary + Subagent构建拆分
- [ ] Review Subagent
- [ ] 更多游戏Skill（狼人杀、剧本杀）
- [ ] 上下文Compact系统
- [ ] 持久化记忆
- [ ] 消息可见性控制
- [ ] 虚拟桌游屋（3D/2D桌面场景）
- [ ] TTS语音合成
- [ ] 多模态支持（图片读取/展示、前端富媒体渲染、bash工具、python工具）
