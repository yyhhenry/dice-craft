# DiceCraft

DiceCraft 是一个基于多 Agent 的桌游创作与游玩平台。用户用自然语言描述游戏构思，Primary Agent 统筹创建游戏资料、调度 Subagent 审查和扮演重要 NPC，并在游玩阶段作为 GM/DM 主持流程。

## 技术栈

- **运行时**：Bun
- **语言**：TypeScript
- **后端**：Hono（HTTP REST） + Bun WebSocket
- **前端**：React + Vite + shadcn/ui + Tailwind CSS
- **AI SDK**：OpenAI SDK，兼容 MiMo API
- **持久化**：JSON / JSONL 文件
- **测试**：Bun test + TypeScript + ESLint

## 快速开始

```bash
bun install
bun run dev                                        # 启动后端 (port 3001)
cd packages/dice-craft-webui && bun run dev        # 启动前端 (port 5173)
```

打开 http://localhost:5173，在 Workspace Settings（齿轮图标）中配置模型：

- **API Base URL**：`https://api.xiaomimimo.com/v1`
- **API Key**：你的 API key
- **Model Name**：`mimo-v2.5-pro`

配置完成后创建 Session 即可开始对话。

## 常用命令

```bash
bun run dev          # 启动后端 HTTP/WS 服务器
bun test             # 运行测试
bun run typecheck    # TypeScript 类型检查
bun run lint         # ESLint 检查
bun run check        # 测试 + 类型检查 + lint
bun run build:webui  # 构建前端
```

## 项目结构

```text
src/
├── index.ts         # 服务器入口
├── app.ts           # 应用组装（Agent + Tool 注册）
├── server/          # Hono REST 路由 + WebSocket + AppPool
├── shared/          # 前后端共享 Zod schema
├── model/           # OpenAI 兼容模型封装
├── agent/           # Agent loop、注册表、Subagent 调度、prompt
├── tool/            # 内置工具与 Skill 发现
├── chat/            # ChatManager 与聊天消息类型
├── session/         # Session 管理和 JSONL 存储
└── workspace/       # Workspace 管理、路径沙箱、模板注入

packages/dice-craft-webui/   # React + Vite 前端
├── src/components/          # UI 组件（layout、chat、session、settings）
├── src/hooks/               # 数据 hooks（useWebSocket、useSessions 等）
└── src/lib/                 # API 客户端

data/
├── workspaces/      # 运行时 workspace 数据
└── sessions/        # 运行时 session 数据
```

## Agent 类型

| 类型 | 角色 | 模式 | 工具范围 |
|------|------|------|----------|
| `builder` | 主 Agent / GM / 构建者 | primary | 全部工具 |
| `npc` | 游戏角色 | subagent | message |
| `explore` | 代码和资料探索 | subagent | 只读工具 |
| `review` | 规则和逻辑审查 | subagent | 只读工具 |

Primary 通过 `notify` 控制 NPC 收到的信息；NPC 通过独立 session 实现上下文隔离。
