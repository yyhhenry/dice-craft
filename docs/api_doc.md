# DiceCraft WebUI API 文档

- **服务名称**：DiceCraft WebUI Service
- **接口版本**：v1
- **最后更新时间**：2026-06-01

---

## 1. 服务信息

### 1.1 服务说明

DiceCraft WebUI Service 为本地 DiceCraft Web 界面提供 Workspace、Session、模型配置、游戏运行状态和 WebSocket 消息事件契约。

DiceCraft 的游戏内容由 workspace 中的 skills、状态文件和 agent 协作生成。API 层不固定某一种桌游类型，也不暴露 DND 等具体游戏 schema。具体游戏状态可由对应 skill 自行维护，例如 `.game-state/<skill-name>.json`。

### 1.2 Base URL

| 环境 | Base URL |
|---|---|
| Dev | `http://localhost:3000/api/v1` |

---

## 2. 通用约定

### 2.1 通用响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| 字段名 | 类型 | 说明 |
|---|---|---|
| code | integer | 业务码，`0` 表示成功 |
| message | string | 响应消息 |
| data | object/array/null | 响应数据 |

### 2.2 通用请求头

| Header | 必填 | 说明 | 示例 |
|---|---:|---|---|
| `Content-Type` | 有请求体时必填 | 请求体格式 | `application/json` |
| `Accept` | 否 | 响应格式 | `application/json` |
| `Authorization` | 非本地开发必填 | Bearer Token | `Bearer dc_dev_token` |
| `X-DiceCraft-Client` | 否 | 调用方标识 | `webui` |
| `X-Request-Id` | 否 | 请求追踪 ID | `req_01jz8demo` |

### 2.3 通用规则

- 空数组返回 `[]`。
- 无值字段返回 `null`。
- 时间使用 ISO 8601 UTC 字符串，例如 `2026-06-01T10:00:00.000Z`。
- 客户端必须忽略未知响应字段，以支持向前兼容。
- HTTP API 用于读取和管理资源；聊天消息发送、agent 状态变化和实时消息流通过 WebSocket 传输。

---

## 3. 前后端交互数据对象

本章只定义 WebUI 与后端之间稳定传输的通用对象。具体游戏规则、角色、地图、物品、怪物、谜题等内容不在本 API 文档中固定，由 workspace 中的 skill 和游戏状态文件自行定义。

### 3.1 `WorkspaceInfo`

用于游戏选择、创建游戏入口和 workspace 列表。

```ts
interface WorkspaceInfo {
  id: string
  name: string
  ownerId: string
  path: string
  skillsDir: string
  createdAt: string
}
```

### 3.2 `WorkspaceConfig`

用于 workspace 级模型配置。API key 可以在返回时由服务端遮蔽，更新时仍提交完整值。

```ts
interface WorkspaceConfig {
  apiBaseUrl: string
  apiKey: string
  modelName: string
}
```

### 3.3 `SessionInfo`

用于 workspace 下的 session 列表。WebUI 只直接展示 primary session；`parentSessionId` 不为空的 subagent session 由后端内部管理。

```ts
interface SessionInfo {
  id: string
  workspaceId: string
  parentSessionId?: string
  title: string
  agentType: string
  systemPrompt?: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
```

### 3.4 `ChatMessage`

聊天流唯一公开消息对象。前端直接按 `senderRole` 渲染，不接触 agent 内部的 OpenAI 格式 `StoredMessage`。

```ts
type SenderRole = "user" | "agent" | "npc" | "system"

interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  senderRole: SenderRole
  content: string
  timestamp: string
}
```

展示约定：

| senderRole | UI 展示 |
|---|---|
| `system` | GM 旁白，居中灰色小字 |
| `user` | 玩家消息，右对齐 |
| `agent` | Builder/GM agent，左对齐 |
| `npc` | 游戏角色，左对齐，显示角色名 |

### 3.5 `SendMessagePayload`

客户端通过 WebSocket 发送用户消息。

```ts
interface SendMessagePayload {
  content: string
}
```

### 3.6 `AgentStatusPayload`

用于通知前端某个 session 的 agent loop 状态。

```ts
interface AgentStatusPayload {
  sessionId: string
  runId?: string
  status: "queued" | "running" | "idle" | "failed"
  error?: string
}
```

### 3.7 `SceneState`

场景状态是预留对象。v0 可只返回最小占位结构；具体游戏场景结构不在 API 层固定。

```ts
interface SceneState {
  sessionId: string
  version: number
  data?: unknown
  updatedAt: string
}
```

### 3.8 WebSocket Event Envelope

WebSocket 使用统一事件信封。

```ts
interface WebSocketEvent<TPayload = unknown> {
  type: string
  eventId: string
  requestId?: string
  occurredAt: string
  payload: TPayload
}
```

### 3.9 `GameStateFile`

游戏本地 JSON 状态不是统一 schema，而是 skill 自己维护的文件。后端只需要保证它处于 workspace 沙箱内。

以 bluff 猜数字游戏为例，状态文件路径：

```text
data/workspaces/<workspaceId>/.game-state/bluff-number-guess.json
```

示例结构：

```json
{
  "max_num": 999,
  "bluff_n": 10.0,
  "candidates": [1, 2, 3],
  "round": 1,
  "history": [
    {
      "round": 1,
      "type": "number",
      "guess": "500",
      "result": "往小猜",
      "remaining_count": 499
    }
  ]
}
```

---

## 4. 错误码

| 业务码 | HTTP 状态码 | 含义 | 调用方处理建议 |
|---:|---:|---|---|
| 0 | 200 | 成功 | 正常处理 |
| 4001001 | 400 | 参数错误 | 修正参数后重试 |
| 4001002 | 400 | Workspace 配置错误 | 修正配置后重试 |
| 4001003 | 400 | 消息内容错误 | 修正空内容或不支持内容 |
| 4011001 | 401 | 认证失败 | 重新认证或刷新 token |
| 4031001 | 403 | 无权限 | 申请权限或更换身份 |
| 4041001 | 404 | 资源不存在 | 检查资源 ID |
| 4091001 | 409 | 状态冲突 | 刷新状态后按有效流程重试 |
| 4091002 | 409 | Agent run 已在执行 | 等待当前 run 完成或先取消 |
| 4221001 | 422 | 校验失败 | 根据 validation issues 修正 |
| 4291001 | 429 | 请求过于频繁 | 按服务端延迟建议重试 |
| 5001001 | 500 | 服务内部异常 | 必要时带 request ID 反馈 |
| 5021001 | 502 | 模型供应商异常 | 稍后重试或切换模型配置 |

错误响应示例：

```json
{
  "code": 4001001,
  "message": "workspace_id is required",
  "data": null
}
```

---

## 5. REST API

### 5.1 Workspace API

Workspace 是 WebUI 的游戏选择和创建游戏入口。每个 workspace 隔离 skills、游戏状态文件、模型配置和 session。

#### 5.1.1 List Workspaces

- **方法**：`GET`
- **路径**：`/workspaces`
- **说明**：列出可选择的 workspace，用于 WebUI 初始选择界面。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "cli",
      "name": "CLI Workspace",
      "ownerId": "local",
      "path": "data/workspaces/cli",
      "skillsDir": "data/workspaces/cli/skills",
      "createdAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

#### 5.1.2 Create Workspace

- **方法**：`POST`
- **路径**：`/workspaces`
- **说明**：创建一个新的游戏 workspace。服务端创建 workspace 目录并注入默认 skills。

请求体：

```json
{
  "name": "Bluff Number Guess",
  "ownerId": "local"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "ws_abc123",
    "name": "Bluff Number Guess",
    "ownerId": "local",
    "path": "data/workspaces/ws_abc123",
    "skillsDir": "data/workspaces/ws_abc123/skills",
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
}
```

#### 5.1.3 Get Workspace

- **方法**：`GET`
- **路径**：`/workspaces/{workspace_id}`
- **说明**：获取 workspace 元数据。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "ws_abc123",
    "name": "Bluff Number Guess",
    "ownerId": "local",
    "path": "data/workspaces/ws_abc123",
    "skillsDir": "data/workspaces/ws_abc123/skills",
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
}
```

#### 5.1.4 Get Workspace Config

- **方法**：`GET`
- **路径**：`/workspaces/{workspace_id}/config`
- **说明**：读取 workspace 级模型配置。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "apiBaseUrl": "https://api.xiaomimimo.com/v1",
    "apiKey": "sk-********",
    "modelName": "mimo-v2.5-pro"
  }
}
```

#### 5.1.5 Update Workspace Config

- **方法**：`PUT`
- **路径**：`/workspaces/{workspace_id}/config`
- **说明**：更新 workspace 级模型配置。

请求体：

```json
{
  "apiBaseUrl": "https://api.xiaomimimo.com/v1",
  "apiKey": "sk-xxx",
  "modelName": "mimo-v2.5-pro"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "apiBaseUrl": "https://api.xiaomimimo.com/v1",
    "apiKey": "sk-********",
    "modelName": "mimo-v2.5-pro"
  }
}
```

#### 5.1.6 List Workspace Sessions

- **方法**：`GET`
- **路径**：`/workspaces/{workspace_id}/sessions`
- **说明**：列出 workspace 下可进入的 primary session。subagent session 不直接展示。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "sess_primary",
      "workspaceId": "cli",
      "title": "Bluff Number Guess",
      "agentType": "builder",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:05:00.000Z",
      "messageCount": 12
    }
  ]
}
```

### 5.2 Session API

#### 5.2.1 Create Session

- **方法**：`POST`
- **路径**：`/workspaces/{workspace_id}/sessions`
- **说明**：在指定 workspace 中创建一个 primary builder session。用于新建游戏或新建创作对话。

请求体：

```json
{
  "title": "New Game",
  "agentType": "builder"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "sess_1770000000000_abc123",
    "workspaceId": "ws_abc123",
    "title": "New Game",
    "agentType": "builder",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:00:00.000Z",
    "messageCount": 0
  }
}
```

#### 5.2.2 Get Session

- **方法**：`GET`
- **路径**：`/sessions/{session_id}`
- **说明**：获取用户可进入的 primary session 元数据。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "sess_primary",
    "workspaceId": "cli",
    "title": "Bluff Number Guess",
    "agentType": "builder",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:05:00.000Z",
    "messageCount": 12
  }
}
```

### 5.3 Runtime State API

#### 5.3.1 Get Scene State

- **方法**：`GET`
- **路径**：`/sessions/{session_id}/scene`
- **说明**：读取当前 session 的场景状态。v0 可以返回空占位；具体游戏状态结构不固定。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sessionId": "sess_primary",
    "version": 1,
    "data": null,
    "updatedAt": "2026-06-01T10:05:00.000Z"
  }
}
```

---

## 6. WebSocket Event 协议

### 6.1 连接

- **路径**：`/ws`
- **鉴权**：使用 `Authorization: Bearer <access_token>`；本地开发可使用 `access_token` query 参数。
- **订阅**：连接建立后客户端发送订阅消息。
- **聊天**：消息发送和消息接收均通过 WebSocket 完成，不提供 HTTP Chat API。

订阅示例：

```json
{
  "type": "subscribe",
  "requestId": "req_ws_001",
  "payload": {
    "workspaceIds": ["cli"],
    "sessionIds": ["sess_primary"]
  }
}
```

### 6.2 客户端到服务端事件

#### 6.2.1 `subscribe`

订阅 workspace 或 session 的实时事件。

```json
{
  "type": "subscribe",
  "requestId": "req_ws_001",
  "payload": {
    "workspaceIds": ["cli"],
    "sessionIds": ["sess_primary"]
  }
}
```

#### 6.2.2 `message.send`

发送用户消息，并触发对应 session 的 agent loop。

```json
{
  "type": "message.send",
  "requestId": "req_ws_002",
  "payload": {
    "sessionId": "sess_primary",
    "content": "我猜 500"
  }
}
```

### 6.3 服务端到客户端事件

#### 6.3.1 Event Envelope

```json
{
  "type": "message.created",
  "eventId": "evt_001",
  "requestId": "req_ws_002",
  "occurredAt": "2026-06-01T10:06:00.000Z",
  "payload": {}
}
```

#### 6.3.2 事件类型

| Event type | 说明 | Payload |
|---|---|---|
| `message.created` | 新聊天消息已写入 | `ChatMessage` |
| `agent.status_changed` | Agent 运行状态变化 | `AgentStatusPayload` |
| `scene.updated` | 当前场景或游戏状态更新 | `SceneState` |
| `workspace.updated` | Workspace 元数据或配置变更 | `WorkspaceInfo` |
| `error` | WebSocket 错误 | 通用错误对象 |

消息创建事件示例：

```json
{
  "type": "message.created",
  "eventId": "evt_msg_001",
  "requestId": "req_ws_002",
  "occurredAt": "2026-06-01T10:06:00.000Z",
  "payload": {
    "id": "msg_1770000000000_abc123",
    "sessionId": "sess_primary",
    "senderId": "user",
    "senderName": "Player",
    "senderRole": "user",
    "content": "我猜 500",
    "timestamp": "2026-06-01T10:06:00.000Z"
  }
}
```

Agent 状态事件示例：

```json
{
  "type": "agent.status_changed",
  "eventId": "evt_agent_001",
  "requestId": "req_ws_002",
  "occurredAt": "2026-06-01T10:06:01.000Z",
  "payload": {
    "sessionId": "sess_primary",
    "runId": "run_001",
    "status": "running"
  }
}
```

错误事件示例：

```json
{
  "type": "error",
  "eventId": "evt_error_001",
  "requestId": "req_ws_002",
  "occurredAt": "2026-06-01T10:06:01.000Z",
  "payload": {
    "code": 4001003,
    "message": "message content is empty"
  }
}
```

---

## 7. 版本兼容策略

- 小版本可新增可选字段，不改变接口版本。
- 破坏性变更必须使用新版本路径，例如 `/api/v2`。
- 客户端必须忽略未知字段，不依赖对象字段顺序。
- 具体游戏状态结构由 skill 维护，不作为 API 版本兼容承诺的一部分。

---

## 8. 变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1.1.0 | 2026-06-01 | 新增前后端交互数据对象章节；恢复 Workspace API 作为游戏选择和创建入口；移除 HTTP Chat API，聊天改为 WebSocket 传输；删除具体 DND 对象 schema。 |
| v1.0.2 | 2026-05-27 | 收敛公开 API：删除 Workspace API、Create Session、Validate Game、Submit Player Action、Roll Dice、Update Runtime State 和 Notify NPC，明确 workspace 为后端内部实现细节。 |
| v1.0.1 | 2026-05-27 | 移除 Workspace API 的服务端路径暴露，统一 Session 过滤参数为 `agent_type`，补充核心 DND 对象字段和示例。 |
| v1.0.0 | 2026-05-27 | 初始版本，覆盖 Workspace、Session、Chat、Game Creation、Game Runtime、WebSocket、鉴权、状态码、错误码和 DND 数据对象。 |
