# DiceCraft - 基于多Agent的桌游创作与游玩平台

本项目基于 Bun + TypeScript 开发。用户用自然语言描述游戏规则，多个 Agent 协作完成游戏的构建与运行。

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **包管理**: Bun (bun add / bun install)
- **后端**: Hono (REST) + Bun WebSocket
- **前端**: React + Vite + shadcn/ui（位于 `packages/dice-craft-webui/`）
- **AI**: OpenAI 兼容 API（MiMo 模型）

## 常用命令

```bash
bun install          # 安装依赖
bun run dev          # 同时启动后端 + 前端
bun run dev:backend  # 单独启动后端（port 3001）
bun run dev:webui    # 单独启动前端（port 5173）
bun run test         # 运行测试（必须用 bun run test，不要裸跑 bun test）
bun run lint         # ESLint 检查
bun run typecheck    # 类型检查
bun run check        # 测试 + 类型检查 + lint（每次改完代码必跑）
bun run build:webui  # 构建前端
```

## 项目结构

```
src/
├── index.ts         # 服务器入口（启动 Hono + WebSocket）
├── app.ts           # 应用组装：创建 model、注册 agent/tool、返回 App
├── server/          # HTTP/WS 服务
│   ├── index.ts     # Hono app 组装（REST 路由）
│   ├── start.ts     # Bun.serve 入口（HTTP + WS upgrade）
│   ├── app-pool.ts  # 每 session 的 App 实例池
│   ├── ws.ts        # WebSocket 连接管理和消息分发
│   └── routes/      # REST API 路由（workspaces、sessions）
├── shared/          # 前后端共享 Zod schema
├── model/           # AI SDK 封装（OpenAI 兼容调用）
├── agent/           # Agent 循环 & Subagent 调度
│   ├── loop.ts      # think→tool call→repeat 主循环
│   ├── registry.ts  # Agent 注册表
│   ├── subagent.ts  # Subagent 调度（background/visible 模式）
│   └── prompt/      # System prompt（builder/explore/review/npc）
├── tool/            # 工具定义
│   ├── base.ts      # Tool 接口
│   ├── builtin.ts   # 内置工具注册
│   ├── message.ts   # 聊天消息工具（所有 agent 可用）
│   ├── notify.ts    # NPC 通知工具（primary 专用）
│   ├── skill.ts     # Skill 自动发现
│   ├── bash.ts      # Shell 执行（workspace 沙箱内）
│   ├── read/write/edit/glob/grep  # 文件操作
│   └── time/task.ts # 辅助工具
├── chat/            # 聊天消息系统
│   ├── manager.ts   # ChatManager：消息发送、持久化（chat.jsonl）
│   └── types.ts     # ChatMessage、SenderRole、SenderIdentity
├── session/         # Session 管理
│   ├── store.ts     # SessionStore：JSONL 持久化
│   └── manager.ts   # SessionManager：CRUD、subagent 关联
├── workspace/       # Workspace 管理
│   ├── manager.ts   # WorkspaceManager：创建、路径沙箱、config
│   ├── guard.ts     # 路径权限校验
│   └── templates.macro.ts  # 模板宏注入
packages/dice-craft-webui/   # 前端（React + Vite + shadcn/ui）
├── src/components/          # UI 组件
├── src/hooks/               # 数据 hooks（useWebSocket 等）
└── src/lib/                 # API 客户端
templates/
└── skills/          # 默认 Skill 模板（dice、bluff-number-guess 等）
data/
├── workspaces/      # 运行时 workspace 数据（.meta/ 存配置）
└── sessions/        # 运行时 session 数据
tests/
├── helpers/         # 测试工具（mock server 等）
├── model/           # Model 层测试
├── tool/            # Tool 测试
├── agent/           # Agent 循环测试
├── chat/            # Chat 系统测试
├── session/         # Session 测试
└── workspace/       # Workspace 测试
```

## Agent 类型

| 类型 | 角色 | 模式 | 可用工具 |
|------|------|------|----------|
| `builder` | 主 Agent（GM + 构建者） | primary | 全部工具 |
| `npc` | 游戏角色 | subagent | message（必须设置 sender_name） |
| `explore` | 代码探索 | subagent | read/glob/grep 等只读工具 |
| `review` | 代码审查 | subagent | read/glob/grep 等只读工具 |

- Primary 通过 `notify` 工具向 NPC 发送信息，控制信息流向
- NPC 之间互不可见，信息隔离通过独立 session 物理实现
- Explore/Review 不能向用户发消息，只能 return 结果给调用者

## 开发流程

每次修改源码后，必须运行验证：

```bash
bun run check
```

这会依次执行 `bun test`、`bunx tsc --noEmit` 和 `eslint`，确保：
1. 所有测试通过
2. 没有类型错误
3. 没有 lint 错误

## Git 规范

- 不要主动进行 `git commit` 或 `git push`
- 用户说"commit and push"时，只执行一次，后续不要再自动 commit/push
- 完成任务后可以问用户是否需要 commit，但不要自行决定

## 代码规范

- 源码中的字符串（错误信息、日志、CLI 提示）使用英文
- 游戏内容（system prompt、游戏规则描述）可以使用中文
- 测试描述使用英文

## 环境变量

不再使用 `.env` 文件。模型配置（API Base URL、API Key、Model Name）通过 WebUI 的 Workspace Settings 界面配置，存储在 `data/workspaces/.meta/<id>-config.json`。
