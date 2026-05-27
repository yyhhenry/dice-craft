# DiceCraft

DiceCraft 是一个基于多 Agent 的桌游创作与游玩平台。用户用自然语言描述游戏构思，Primary Agent 统筹创建游戏资料、调度 Subagent 审查和扮演重要 NPC，并在游玩阶段作为 GM/DM 主持流程。

当前实现以 CLI 为入口，核心后端能力已就绪；下一阶段重点是细化 DND 桌游方向，并接入可复用 WebUI。

## 技术栈

- **运行时**：Bun
- **语言**：TypeScript
- **包管理**：Bun
- **AI SDK**：OpenAI SDK，兼容 MiMo API
- **持久化**：JSON / JSONL 文件
- **测试**：Bun test + TypeScript + ESLint

## 快速开始

```bash
bun install
cp .env.example .env
bun run dev
```

在 `.env` 中配置：

```bash
OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=sk-xxx
MODEL_NAME=mimo-v2.5-pro
```

CLI 启动后输入消息即可与 DiceCraft 交互，输入 `/quit` 退出。

## 常用命令

```bash
bun run dev          # 运行 CLI
bun test             # 运行测试
bun run typecheck    # TypeScript 类型检查
bun run lint         # ESLint 检查
bun run check        # 测试 + 类型检查 + lint
```

## 当前能力

- OpenAI 兼容流式调用和 tool call 解析
- Primary Agent + Subagent 调度
- Agent 类型注册：`builder`、`explore`、`review`、`npc`
- Workspace 沙箱与文件工具：read、write、edit、glob、grep
- Bash 工具：在 workspace 内执行脚本和测试命令
- Session 持久化：主 session 与 subagent session 使用统一 JSON/JSONL 存储
- Chat 消息系统：用户、Agent、NPC、system 消息统一写入 `chat.jsonl`
- `message` 工具：Agent/NPC 发送可见消息
- `notify` 工具：Primary 向指定 NPC Subagent 发送私有通知
- Skill 自动发现：读取 workspace 中的 `SKILL.md`
- 默认 Skill 模板：`dice`、`bluff-number-guess`

## 项目结构

```text
src/
├── index.ts         # CLI 入口
├── app.ts           # 应用组装
├── model/           # OpenAI 兼容模型封装
├── agent/           # Agent loop、注册表、Subagent 调度、prompt
├── tool/            # 内置工具与 Skill 发现
├── chat/            # ChatManager 与聊天消息类型
├── session/         # Session 管理和 JSONL 存储
└── workspace/       # Workspace 管理、路径沙箱、模板注入

templates/
└── skills/          # 默认 Skill 模板

data/
├── workspaces/      # 运行时 workspace 数据
└── sessions/        # 运行时 session 数据

docs/
├── done/            # 已完成设计计划
└── PLAN-webui-v0.md # WebUI v0 计划

tests/               # 单元测试
```

## Agent 类型

| 类型 | 角色 | 模式 | 工具范围 |
|------|------|------|----------|
| `builder` | 主 Agent / GM / 构建者 | primary | 全部工具 |
| `npc` | 游戏角色 | subagent | message |
| `explore` | 代码和资料探索 | subagent | 只读工具 |
| `review` | 规则和逻辑审查 | subagent | 只读工具 |

Primary 通过 `notify` 控制 NPC 收到的信息；NPC 通过独立 session 实现上下文隔离。

## DND 方向

下一阶段目标是把 DiceCraft 细化为 DND 式桌游创作与游玩平台：

- 构建阶段生成世界设定、任务线、关键 NPC、怪物、地图、骰子规则和隐藏线索。
- Review Agent 检查逻辑、难度、信息泄露和数值平衡。
- 游玩阶段由 DM Agent 主持冒险。
- 普通 NPC 由 DM 即时生成回答，重要 NPC 使用 Subagent 保存独立记忆和立场。
- 通用 DND Skill 复用掷骰、角色卡、状态、攻击判定和伤害计算。
- WebUI 复用聊天、角色卡、地图、状态、掷骰和战斗面板。

详细任务拆分见 [task.md](task.md)。
