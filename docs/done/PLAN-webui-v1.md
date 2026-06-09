# Plan: WebUI v1 — DiceCraft 游玩场景界面

## 目标

在 v0 的 workspace/session/sidebar + 聊天基础上，补齐可游玩的桌游场景界面。v1 的核心目标是让玩家重新进入历史 session 或刷新页面后，可以立即恢复当前游戏视图：地图、DM、其他角色、主线任务、当前玩家角色卡、历史消息和输入框。

v1 仍然保持 DiceCraft 的通用桌游定位：API 不绑定 DND、猜数字或某一种游戏规则。具体游戏状态仍由 workspace 中的 skill 和 `.game-state/` 文件维护；WebUI 只消费一层稳定的展示模型 `SceneState`。

## 页面结构

### 1. 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │                 Play Surface              │ History │
│         │                                           │         │
│         │        [DM]                               │         │
│         │   [角色]   ┌──────── 地图 ────────┐ [角色] │         │
│         │            │                      │        │         │
│         │   [角色]   │                      │ [角色] │         │
│         │            └──────────────────────┘        │         │
│         │   ┌ 主线任务 ┐       ┌ 当前玩家角色卡 ┐     │ Input   │
└──────────────────────────────────────────────────────────────┘
```

- 左侧保留 v0 sidebar：workspace 选择、设置、session 列表。
- 中央为游玩场景区，承载当前 session 的可视化状态。
- 右侧为消息区，上方历史消息，下方玩家输入。
- 不再把聊天作为唯一主视图；聊天消息成为右侧历史消息面板。

### 2. 中央游玩场景区

中央区域由通用槽位组成：

| 区域 | 说明 |
|---|---|
| DM | 当前 GM/DM 状态，可显示名称、头像、运行状态、最近旁白摘要 |
| Map | 地图或场景主画布。可显示图片、网格、文本区域或 skill 生成的 lightweight JSON 渲染结果 |
| Other Characters | 非当前玩家角色，包括 NPC、队友、敌对角色等，由 scene 的角色列表驱动 |
| Main Quest | 当前主线任务、目标、阶段、完成状态 |
| Player Card | 当前玩家的角色卡，显示姓名、身份、生命/资源、关键属性、状态效果 |

v1 不要求实现复杂地图编辑器。地图始终为网格结构——无数据时为空，有网格时渲染 2D 像素瓦片，可附带叙事文本。GM 通过文本艺术文件（`.game-state/*.map`）编辑地图，`update_scene` 工具读取文件并刷新前端。详见 [PLAN-scene.md](PLAN-scene.md)。

### 3. 右侧历史消息区

历史消息区消费 `ChatMessage[]`，用于：

- 重新进入历史 session 时加载 `chat.jsonl`。
- 刷新当前页面后恢复聊天上下文。
- WebSocket 断线重连后用 REST 补齐漏掉的消息。

显示规则沿用 v0：

| senderRole | 展示方式 |
|---|---|
| `system` | GM/DM 旁白，居中灰色小字 |
| `user` | 当前玩家，右对齐 |
| `agent` | Builder/GM agent，左对齐，使用工具/DM 图标 |
| `npc` | 角色消息，左对齐，显示角色名 |

历史消息接口必须支持分页或游标，避免一次性读取超长 session。

### 4. 玩家输入区

输入区固定在右下方：

- 多行文本输入。
- 发送按钮。
- Enter 发送，Shift+Enter 换行。
- 发送通过 WebSocket `message.send`，成功后服务端广播 `message.created`。
- 如果 WebSocket 不可用，前端显示连接错误；v1 不新增 HTTP 发送消息接口。

## 数据模型

### SceneState

`SceneState` 是 v1 前端渲染游玩界面的核心对象。它是展示层状态，不替代 skill 自己的游戏状态文件。

```ts
interface SceneState {
  sessionId: string
  version: number
  title?: string
  dm: SceneDM
  map: SceneMap
  characters: SceneCharacter[]
  mainQuest?: SceneQuest
  playerCard?: ScenePlayerCard
  layout?: SceneLayout
  updatedAt: string
}
```

### 设计原则

- `SceneState` 只描述 WebUI 怎么展示，不定义游戏判定规则。
- 复杂或私有状态保留在 `.game-state/<skill-name>.json`。
- skill 可以通过 builder agent 把内部状态投影为 `SceneState`。
- 前端必须忽略未知字段，允许后续增加新展示槽位。

## REST API 变更

v1 在 v0 API 基础上新增：

```text
GET /api/v1/sessions/:session_id/messages
```

用途：

- 重新进入历史 session 时加载历史消息。
- 刷新页面时恢复当前 session 消息。
- WebSocket 重连后按 `after` 游标补拉消息。

查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `limit` | number | 返回条数，默认 50，最大 200 |
| `before` | string | 返回指定 message id 之前的消息，用于向上翻页 |
| `after` | string | 返回指定 message id 之后的消息，用于断线补齐 |

响应：

```ts
interface MessageHistoryPage {
  items: ChatMessage[]
  nextBefore?: string
  nextAfter?: string
  hasMoreBefore: boolean
  hasMoreAfter: boolean
}
```

## WebSocket 变更

继续沿用 v0 的 WebSocket 事件：

- `message.created`：右侧历史消息追加。
- `agent.status_changed`：DM/发送按钮/加载状态更新。
- `scene.updated`：中央游玩场景刷新。

页面首次进入 session 的推荐加载顺序：

1. `GET /sessions/:session_id`
2. `GET /sessions/:session_id/scene`
3. `GET /sessions/:session_id/messages?limit=50`
4. 建立 WebSocket，发送 `subscribe`
5. 如果订阅成功前已有最新 message id，则用 `GET /sessions/:session_id/messages?after=<last_id>` 补齐

## 前端组件调整

```
packages/dice-craft-webui/src/components/
├── scene/
│   ├── PlaySurface.tsx
│   ├── DMPanel.tsx
│   ├── MapPanel.tsx
│   ├── CharacterBadge.tsx
│   ├── QuestPanel.tsx
│   └── PlayerCard.tsx
├── chat/
│   ├── HistoryPanel.tsx
│   ├── MessageList.tsx
│   └── ChatInput.tsx
└── session/
    └── SessionShell.tsx
```

`SessionShell` 负责把当前 session 组织为三栏布局：

- 左侧 sidebar。
- 中央 `PlaySurface`。
- 右侧 `HistoryPanel + ChatInput`。

## 实施步骤

### Step 1: API schema 更新

- 在共享 schema 中新增 v1 `SceneState` 相关类型。
- 新增消息历史分页响应类型 `MessageHistoryPage`。
- 保持 `ChatMessage` 继续来自 `src/chat/types.ts`。

### Step 2: 后端 REST 接口

- 实现 `GET /sessions/:session_id/messages`。
- 从 `data/sessions/<sessionId>/chat.jsonl` 读取消息。
- 支持 `limit`、`before`、`after`。
- 只允许读取 primary session 的 chat；subagent session 不直接暴露聊天记录。

### Step 3: 场景状态投影

- 实现 `SceneManager`：读写 `data/sessions/<sessionId>/scene-state.json`。
- 实现 `update_scene` 工具：GM agent 通过此工具管理场景状态。
- 实现 `GET /sessions/:session_id/scene` 返回 `SceneState`。
- 实现 `scene.updated` WebSocket 事件广播。
- 更新 builder prompt，增加场景控制说明。
- 详见 [PLAN-scene.md](PLAN-scene.md)。

### Step 4: 前端布局

- 将 v0 聊天主视图替换为三栏 session shell。
- 中央实现 DM、地图（SVG 瓦片渲染）、角色、任务、角色卡区域。
- 右侧实现历史消息分页和输入区。

### Step 5: 刷新和重进恢复

- 进入 session 时并行加载 session metadata、scene、messages。
- WebSocket 建连后订阅当前 session。
- 用 `after` 参数补齐 REST 加载和 WS 订阅之间产生的消息。

## 不在 v1 范围内

- NPC 场景感知工具（observe_scene、request_action）— 设计已预留，见 [PLAN-scene.md](PLAN-scene.md)。
- 自定义瓦片素材上传。
- 地图动画、战争迷雾、多层地图。
- 复杂地图编辑器。
- 多用户账号和权限系统。
- 语音、图片上传、文件拖拽。
- 针对某一种桌游的专用规则面板。
- HTTP 发送聊天消息接口。
