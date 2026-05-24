# Plan: Frontend v0 — DiceCraft Web UI

## 目标

为 DiceCraft 创建一个 Web 前端，将 CLI 交互升级为浏览器界面。v0 聚焦左侧 sidebar + 聊天流，**右侧画布为空**——这是本版本的主要短板，后续版本再填充场景内容。

本系统定位为本地使用的 OpenClaw 类工具，不涉及多用户，因此 v0 不做账号系统。

## 技术选型

- **脚手架**: `bunx --bun shadcn@latest init --preset b0 --template vite --pointer`
- **前端框架**: React + Vite + TypeScript
- **后端框架**: Hono（轻量、Bun 原生支持、类型安全路由）
- **UI 组件库**: shadcn/ui (Radix + Tailwind CSS)
- **图标**: Lucide（shadcn 推荐，tree-shakeable）
- **校验**: Zod（API 响应 & 表单校验，类型推导共享前后端 schema）
- **实时通信**: WebSocket（场景推送、消息流）
- **位置**: 前端 `packages/dice-craft-frontend/`，后端与现有 `src/` 同项目（Hono 路由集成在现有 Bun 应用中）

### UI 风格

简约干净。大量留白，克制用色，信息密度适中。参考 Linear / Notion 的克制感——不追求视觉冲击，追求信息层级清晰、操作直觉自然。shadcn 默认主题作为基调，不做过多定制。

## 模型配置

**不再使用 `.env` 文件**。模型相关配置（API base URL、API key、model name）改为 workspace 级别设置，存储在 workspace 的配置文件中。

### 配置项

| 字段 | 说明 | 示例 |
|---|---|---|
| `apiBaseUrl` | OpenAI 兼容 API 地址 | `https://api.xiaomimimo.com/v1` |
| `apiKey` | API 密钥 | `sk-xxx` |
| `modelName` | 模型名称 | `mimo-v2.5-pro` |

### 存储位置

```
data/workspaces/<id>/config.json
```

复用现有 `WorkspaceInfo` 结构，在其中扩展 `config` 字段：

```typescript
interface WorkspaceConfig {
  apiBaseUrl: string
  apiKey: string
  modelName: string
}
```

### 模型选择器 UI

在 Workspace 设置面板中提供模型配置界面：

```
┌─ Workspace 设置 ─────────────────────┐
│                                       │
│  API Base URL                         │
│  [https://api.xiaomimimo.com/v1    ]  │
│                                       │
│  API Key                              │
│  [sk-••••••••••••••••••         👁]  │
│                                       │
│  Model Name                           │
│  [mimo-v2.5-pro          ▼]          │
│  常用模型: mimo-v2.5-pro              │
│            gpt-4o                     │
│            claude-sonnet-4-6          │
│                                       │
│              [保存]                   │
└───────────────────────────────────────┘
```

- Model Name 为自由输入 + 常用模型下拉建议
- API Key 默认遮蔽，点击眼睛图标切换可见
- 入口：sidebar 顶部 workspace 选择器旁的齿轮图标

## 页面结构

### 1. Sidebar（左侧）

```
┌──────────────────────┐
│ ▼ Workspace   ⚙     │  ← sticky 顶部：workspace 下拉 + 设置入口
│──────────────────────│
│ Session A            │
│ Session B            │
│ Session C            │
│ ...                  │
└──────────────────────┘
```

- **Workspace 选择器**: sticky 在 sidebar 顶部，下拉列出所有 workspace
- **设置入口**: 齿轮图标，打开 workspace 设置面板（含上述模型配置）
- **Session 列表**: 选中 workspace 后列出 primary session（`parentSessionId` 为空）
- 点击 session → 进入聊天界面

### 2. Main Area — 默认视图（Session 选择态）

```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│          [ 空画布 — v0 占位 ]        │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

v0 阶段右侧为空白区域。这是本版本的主要局限——核心交互仅通过左侧聊天流进行，缺少可视化的场景呈现。后续版本将在此渲染游戏地图、角色面板等场景内容。

### 3. Main Area — 聊天视图（Session 激活态）

点击 sidebar 中的 session 后，main area 切换为聊天界面：

```
┌──────────────────────────────────────┐
│ ← 返回           Session Title       │  ← 顶部导航栏
│──────────────────────────────────────│
│                                      │
│         【GM 旁白居中小字】           │  ← senderRole="system"
│                                      │
│  🧙 Gandalf                    │     │  ← senderRole="agent" / "npc"
│  "冒险者们，前方有危险"              │     │
│                                      │
│                          玩家 A  🧑  │  ← senderRole="user"
│                    "我要前进！"       │     │
│                                      │
│──────────────────────────────────────│
│ [输入消息...]              [发送]    │  ← 底部输入框
└──────────────────────────────────────┘
```

#### 消息样式规则

| senderRole | 展示方式 |
|---|---|
| `"system"` (GM 旁白) | 居中，小字，灰色，无头像 |
| `"user"` (玩家) | 右对齐，带头像/名称 |
| `"agent"` (Build Agent) | 左对齐，带头像/名称 |
| `"npc"` (游戏角色) | 左对齐，显示 **角色名** + 说的话 |

#### 顶部导航栏

- 左侧: 返回按钮（回到 workspace/session 选择视图）
- 中间: 当前 session 标题
- 右侧: 预留

#### 底部输入框

- 文本输入 + 发送按钮
- Enter 发送，Shift+Enter 换行
- 发送后调用后端 API（v0 可先 mock）

## 数据对接

### 后端：Hono

Hono 路由集成在现有项目 `src/` 中，与 CLI 入口并行运行。复用现有的 `SessionStore`、`WorkspaceManager`、`ChatManager` 等模块，不需要新建独立后端包。

```typescript
// src/server/index.ts
import { Hono } from "hono"
import { cors } from "hono/cors"
import { workspaceRoutes } from "./routes/workspaces"
import { sessionRoutes } from "./routes/sessions"
import { wsRoutes } from "./routes/ws"

const app = new Hono()
app.use("/*", cors())
app.route("/api", workspaceRoutes)
app.route("/api", sessionRoutes)
app.route("/api", wsRoutes)

export { app }
```

入口 `src/index.ts` 根据启动参数决定运行 CLI 还是 HTTP server：

```bash
bun run src/index.ts              # CLI 模式（现有行为）
bun run src/index.ts --serve      # HTTP + WebSocket server
```

### API 路由

```
GET    /api/workspaces                    → WorkspaceInfo[]
GET    /api/workspaces/:id/config         → WorkspaceConfig
PUT    /api/workspaces/:id/config         → WorkspaceConfig
GET    /api/workspaces/:id/sessions       → SessionInfo[]  (primary only)
GET    /api/sessions/:id/messages         → ChatMessage[]
POST   /api/sessions/:id/messages         → { content: string }
WS     /api/ws/sessions/:id               → 实时消息 & 场景推送
```

### Zod Schema

前后端共享 Zod schema，用于校验和类型推导：

```typescript
// src/shared/schemas.ts
import { z } from "zod"

export const WorkspaceConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiKey: z.string().min(1),
  modelName: z.string().min(1),
})

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>
```

`ChatMessage` 类型直接复用 `src/chat/types.ts` 中的定义，不需要额外的 Zod schema——它由 `ChatManager` 内部产出，不来自外部输入。

### WebSocket 协议

场景更新和消息流通过同一 WebSocket 连接推送，用 `type` 字段区分：

```
服务端 → 客户端：
  { type: "message",        payload: ChatMessage }
  { type: "scene_update",   payload: SceneState }
  { type: "agent_thinking", payload: { sessionId: string } }

客户端 → 服务端：
  { type: "send_message",   payload: { content: string } }
```

v0 阶段 `scene_update` 暂不推送实际内容，仅预留协议结构。`ChatMessage` 来自 `src/chat/types.ts`，与 REST API 返回的结构一致。

### 消息类型

前端直接消费 `ChatMessage`（定义在 `src/chat/types.ts`），它已携带 `senderRole` 和 `senderName`，无需额外映射。

| senderRole | 谁 | UI 展示 |
|---|---|---|
| `"system"` | GM 旁白 | 居中小字灰色 |
| `"user"` | 玩家 | 右对齐 |
| `"agent"` | Builder 构建者 | 左对齐，专属图标（如 wrench），区别于游戏角色 |
| `"npc"` | 游戏角色 | 左对齐，显示角色名（如"酒馆老板"） |

`ChatMessage` 由 `ChatManager.sendMessage()` 产出，持久化在 `chat.jsonl`。前端通过 REST 或 WebSocket 获取的都是这个结构，不接触 `StoredMessage`（OpenAI 格式的 session 日志）。

### Agent Prompt 适配

v0 上线后，需要更新各 agent 的 system prompt，让它们了解自己在界面上的呈现方式和能力边界。

**builder（primary，同时承担 GM 和构建者两种身份）**:
- 使用 `message` 工具时通过 `senderRole` 控制两种身份的显示效果
- GM 旁白：`senderRole="system"`，显示为居中灰色小字
- 构建者发言：`senderRole="agent"`，前端给 builder 专属图标（如 wrench），让用户区分构建操作和游戏内容
- builder 不替 NPC 说话，NPC 由各自的 subagent 自行发言

**npc（subagent）**:
- 通过 `message` 工具自行发言，`senderRole="npc"` + `senderName` 设置为自己的角色名
- 消息以角色名显示为左侧气泡，prompt 中强调保持角色感、不跳出角色
- 后续版本 NPC 还会有自己的角色操作，prompt 需持续适配

**explore / review（subagent）**:
- 不能使用 `message` 工具向用户发消息，只能将结果返回给调用者（primary）
- prompt 中明确：你的输出不会显示在游戏界面上，通过 return 值返回给 builder

## 项目结构

```
src/                                    # 后端（现有项目，新增 server 模块）
├── ...                                 # 现有模块不变
├── server/                             # 新增：Hono HTTP/WS 服务
│   ├── index.ts                        # Hono app 组装
│   ├── routes/
│   │   ├── workspaces.ts
│   │   ├── sessions.ts
│   │   └── ws.ts                       # WebSocket handler
│   └── middleware/
│       └── validate.ts                 # Zod 校验中间件
└── shared/                             # 前后端共享 Zod schema
    └── schemas.ts

packages/dice-craft-frontend/           # 前端
├── src/
│   ├── App.tsx                         # 全局布局
│   ├── main.tsx                        # 入口
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx             # 左侧 sidebar
│   │   │   └── WorkspaceSelect.tsx     # workspace 下拉 + 设置入口
│   │   ├── settings/
│   │   │   └── WorkspaceSettings.tsx    # 模型配置面板
│   │   ├── session/
│   │   │   ├── SessionList.tsx         # session 列表
│   │   │   └── SessionItem.tsx         # 单个 session 条目
│   │   ├── chat/
│   │   │   ├── ChatView.tsx            # 聊天主视图
│   │   │   ├── ChatHeader.tsx          # 顶部导航栏
│   │   │   ├── MessageList.tsx         # 消息列表
│   │   │   ├── MessageBubble.tsx       # 单条消息气泡
│   │   │   └── ChatInput.tsx           # 底部输入框
│   │   └── scene/
│   │       └── ScenePlaceholder.tsx    # 场景占位（空画布）
│   ├── hooks/
│   │   ├── useWorkspaces.ts
│   │   ├── useSessions.ts
│   │   ├── useMessages.ts
│   │   ├── useWorkspaceConfig.ts
│   │   └── useWebSocket.ts             # WS 连接管理
│   ├── lib/
│   │   ├── api.ts                      # REST API 调用（含 mock）
│   │   └── ws.ts                       # WebSocket 客户端
│   └── types/
│       └── index.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 实施步骤

### Step 1: 项目初始化

```bash
cd packages
bunx --bun shadcn@latest init --preset b0 --template vite --pointer dice-craft-frontend
cd dice-craft-frontend
bun install
bun add lucide-react zod
```

在主项目中安装 Hono：

```bash
cd /home/henry/src/dice-craft
bun add hono
```

配置 path alias (`@/` → `src/`)，确认 dev server 可启动。

### Step 2: 共享 Schema + 后端路由

- 定义 Zod schema（`src/shared/schemas.ts`），推导 TypeScript 类型
- 在 `src/server/` 中搭建 Hono 路由，配置 CORS、Zod 校验中间件
- 复用现有 `SessionStore`、`WorkspaceManager` 实现 REST 路由
- 实现 WebSocket endpoint（消息推送，v0 暂不推场景）
- `src/index.ts` 添加 `--serve` 参数分支

### Step 3: 前端基础布局 + Workspace 设置

- Sidebar + Main 双栏布局
- WorkspaceSelect 下拉 + 齿轮图标（Lucide `Settings`）
- WorkspaceSettings 面板（apiBaseUrl、apiKey、modelName）
- 表单用 Zod 做前端校验

### Step 4: 聊天界面

- ChatView（ChatHeader、MessageList、ChatInput）
- MessageBubble 按 senderRole 渲染不同样式
- GM 旁白居中、玩家右对齐、agent/npc 左对齐
- Lucide 图标用于 UI 元素（ArrowLeft、Send、User、Bot 等）

### Step 5: 前后端联调

- 前端对接 Hono REST API（替换 mock）
- WebSocket 连接管理（`useWebSocket` hook）
- 消息实时推送：发送 → 服务端处理 → WS 回推
- 移除 `.env` 依赖，后端从 workspace config 读取模型配置

## v0 的主要局限

**右侧画布为空**。当前版本的交互完全在聊天流中进行，缺少可视化的游戏场景。这是后续版本需要优先解决的问题。

## 不在 v0 范围内

- 账号/认证系统（本地工具，无需多用户）
- 场景渲染（地图、角色状态面板）—— v1 优先，WebSocket 协议已预留
- 高级设置：文件阅览/编辑界面，用于直接管理 workspace 内容（Skill 文件、游戏状态等）
- Session 创建/删除操作
- 移动端适配
