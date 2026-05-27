# DiceCraft DND API 文档

- **服务名称**：DiceCraft DND Service
- **接口版本**：v1
- **最后更新时间**：2026-05-27

> 批注(@yyhhenry)：直接定死了DND相关的一些schema，不应该直接体现在接口中，这些应该允许自由创建，可以做成相关skill，但是不要直接在这里定死，整个dice craft项目的schema约束。

---

## 1. 服务信息

### 1.1 服务说明

DiceCraft DND Service 为 DiceCraft 的 DND 式桌游创作与游玩流程提供 Session、Chat、Game Creation、Game Runtime 和 WebSocket 事件契约。

当前项目以 CLI 为入口，本文件定义后续服务化和 WebUI 对接时必须遵循的公开 API 契约。Workspace 是后端内部实现细节，用于隔离文件、skills 和 agent 执行环境；前端产品层应使用 Game、Room 或 Campaign 等概念，不直接依赖 workspace。

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
| `X-Request-Id` | 否 | 请求追踪 ID | `req_01jz8dnddemo` |

### 2.3 通用规则

- 空数组返回 `[]`。
- 无值字段返回 `null`。
- 时间使用 ISO 8601 UTC 字符串，例如 `2026-05-27T10:00:00.000Z`。
- 分页默认：`page_no=1`，`page_size=20`。
- `page_size` 范围为 `1` 到 `100`。
- 客户端必须忽略未知响应字段，以支持向前兼容。
- 持久化游戏对象应包含 `api_version: "v1"`。

### 2.4 分页响应结构

```json
{
  "items": [],
  "page_no": 1,
  "page_size": 20,
  "total": 0,
  "has_more": false
}
```

### 2.5 鉴权机制

服务使用 Bearer Token 鉴权：

```http
Authorization: Bearer <access_token>
```

本地开发环境可通过服务端配置允许固定 dev token。生产环境必须在访问 Session、Chat、Game 和 Runtime 资源前校验 token。

权限范围：

| Scope | 说明 |
|---|---|
| `session:read` | 读取 session 与 chat message |
| `session:write` | 发送用户消息 |
| `game:read` | 读取游戏资料与运行时状态 |
| `game:write` | 创建游戏、启动运行时 |

---

## 3. 错误码

| 业务码 | HTTP 状态码 | 含义 | 调用方处理建议 |
|---:|---:|---|---|
| 0 | 200 | 成功 | 正常处理 |
| 4001001 | 400 | 参数错误 | 修正参数后重试 |
| 4001002 | 400 | 游戏对象结构错误 | 修正游戏对象后重试 |
| 4001003 | 400 | 消息内容错误 | 修正空内容或不支持的内容类型 |
| 4011001 | 401 | 认证失败 | 重新认证或刷新 token |
| 4031001 | 403 | 无权限 | 申请权限或更换身份 |
| 4041001 | 404 | 资源不存在 | 检查资源 ID |
| 4091001 | 409 | 状态冲突 | 刷新状态后按有效流程重试 |
| 4091002 | 409 | Agent run 已在执行 | 等待当前 run 完成或先取消 |
| 4221001 | 422 | 规则校验失败 | 根据 validation issues 修正 |
| 4291001 | 429 | 请求过于频繁 | 按服务端延迟建议重试 |
| 5001001 | 500 | 服务内部异常 | 必要时带 request ID 反馈 |
| 5021001 | 502 | 模型供应商异常 | 稍后重试或切换模型配置 |

错误响应示例：

```json
{
  "code": 4001001,
  "message": "session_id is required",
  "data": null
}
```

校验错误示例：

```json
{
  "code": 4221001,
  "message": "game validation failed",
  "data": {
    "issues": [
      {
        "path": "characters[0].hp.current",
        "message": "hp must be greater than or equal to 0"
      }
    ]
  }
}
```

---

## 4. REST API

### 4.1 Session API

#### 4.1.1 List Sessions

- **方法**：`GET`
- **路径**：`/sessions`
- **说明**：查询当前用户可进入的 primary/DM session。NPC、explore、review 等 subagent session 由后端内部管理，不直接暴露给前端创建或进入。

请求参数：

| 参数名 | 类型 | 必填 | 说明 | 约束/示例 |
|---|---|---:|---|---|
| game_id | string | 否 | 关联游戏过滤 | `game_...` |
| mode | string | 否 | Session 模式过滤 | `creation`, `runtime` |
| page_no | integer | 否 | 页码 | `1` |
| page_size | integer | 否 | 每页数量 | `20` |

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": "ses_01jz8dnddemo000000000001",
        "agent_type": "builder",
        "mode": "creation",
        "title": "Create a Middle Earth adventure",
        "metadata": {
          "game_id": null
        },
        "created_at": "2026-05-27T10:00:00.000Z",
        "updated_at": "2026-05-27T10:05:00.000Z"
      }
    ],
    "page_no": 1,
    "page_size": 20,
    "total": 1,
    "has_more": false
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| mode 非法 | 400 | 4001001 | Session 模式不支持 |

#### 4.1.2 Get Session

- **方法**：`GET`
- **路径**：`/sessions/{session_id}`
- **说明**：获取用户可进入的 primary/DM session 元数据。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "ses_01jz8dnddemo000000000001",
    "agent_type": "builder",
    "mode": "creation",
    "title": "Create a Middle Earth adventure",
    "metadata": {
      "game_id": "game_01jz8dnddemo00000000001"
    },
    "created_at": "2026-05-27T10:00:00.000Z",
    "updated_at": "2026-05-27T10:05:00.000Z"
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| Session 不存在 | 404 | 4041001 | 查询不到对应 session |
| 无权进入 | 403 | 4031001 | 当前用户不可访问该 session |

### 4.2 Chat API

#### 4.2.1 List Messages

- **方法**：`GET`
- **路径**：`/sessions/{session_id}/messages`
- **说明**：读取 session 聊天消息。

请求参数：

| 参数名 | 类型 | 必填 | 说明 | 约束/示例 |
|---|---|---:|---|---|
| session_id | string | 是 | Session ID | `ses_...` |
| after_id | string | 否 | 游标 message ID | `msg_...` |
| limit | integer | 否 | 最大返回数量 | `50` |
| include_private | boolean | 否 | 是否包含授权可见的私有记录 | `false` |

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": "msg_01jz8dnddemo000000000001",
        "session_id": "ses_01jz8dnddemo000000000001",
        "sender": {
          "role": "user",
          "name": "Player",
          "agent_type": null,
          "npc_id": null
        },
        "visibility": "public",
        "content_type": "text",
        "content": "I want to play a Lord of the Rings style adventure.",
        "metadata": {},
        "created_at": "2026-05-27T10:00:00.000Z"
      }
    ],
    "has_more": false
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| Session 不存在 | 404 | 4041001 | 查询不到对应 session |
| 私有记录无权限 | 403 | 4031001 | 缺少读取私有记录权限 |

#### 4.2.2 Send Message

- **方法**：`POST`
- **路径**：`/sessions/{session_id}/messages`
- **说明**：发送用户消息，并可触发对应 Agent loop。

请求体：

```json
{
  "content": "I search the ruined watchtower.",
  "content_type": "text",
  "trigger_agent": true,
  "metadata": {
    "client_message_id": "client_msg_001"
  }
}
```

| 参数名 | 类型 | 必填 | 说明 | 约束/示例 |
|---|---|---:|---|---|
| content | string | 是 | 消息正文 | 1 到 12000 字符 |
| content_type | string | 否 | 内容类型 | `text` |
| trigger_agent | boolean | 否 | 是否触发 Agent | `true` |
| metadata | object | 否 | 客户端元数据 | `client_message_id` |

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "message": {
      "id": "msg_01jz8dnddemo000000000002",
      "session_id": "ses_01jz8dnddemo000000000001",
      "sender": {
        "role": "user",
        "name": "Player",
        "agent_type": null,
        "npc_id": null
      },
      "visibility": "public",
      "content_type": "text",
      "content": "I search the ruined watchtower.",
      "metadata": {
        "client_message_id": "client_msg_001"
      },
      "created_at": "2026-05-27T10:06:00.000Z"
    },
    "agent_run": {
      "id": "run_01jz8dnddemo000000000001",
      "status": "queued"
    }
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| 消息为空 | 400 | 4001003 | content 为空 |
| Agent 正在运行 | 409 | 4091002 | 当前 session 已有 active run |

### 4.3 Game Creation API

#### 4.3.1 Create Game

- **方法**：`POST`
- **路径**：`/games`
- **说明**：提交自然语言需求，启动 Builder Agent 生成 DND 冒险资料。服务端负责创建或复用后端 workspace 与 primary/builder session。

请求体：

```json
{
  "prompt": "I want to play a Lord of the Rings style adventure.",
  "session_id": "ses_01jz8dnddemo000000000001",
  "options": {
    "language": "zh-CN",
    "tone": "heroic fantasy",
    "player_count": 4,
    "difficulty": "normal"
  }
}
```

| 参数名 | 类型 | 必填 | 说明 | 约束/示例 |
|---|---|---:|---|---|
| prompt | string | 是 | 游戏创作需求 | 1 到 12000 字符 |
| session_id | string | 否 | 复用的用户可进入 builder session | `ses_...` |
| options.language | string | 否 | 输出语言 | `zh-CN` |
| options.tone | string | 否 | 叙事风格 | `heroic fantasy` |
| options.player_count | integer | 否 | 玩家数量 | `1` 到 `8` |
| options.difficulty | string | 否 | 难度 | `easy`, `normal`, `hard` |

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "game_id": "game_01jz8dnddemo00000000001",
    "session_id": "ses_01jz8dnddemo000000000001",
    "status": "creating",
    "created_at": "2026-05-27T10:00:00.000Z"
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| prompt 非法 | 400 | 4001001 | prompt 为空或过长 |
| Session 不存在 | 404 | 4041001 | 指定 builder session 不存在 |
| Agent 正在运行 | 409 | 4091002 | builder session 已有 active run |

#### 4.3.2 Get Game

- **方法**：`GET`
- **路径**：`/games/{game_id}`
- **说明**：读取生成的游戏资料。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "game_01jz8dnddemo00000000001",
    "api_version": "v1",
    "status": "ready",
    "title": "Shadows over the White Road",
    "visibility": {
      "player_safe_summary": "A fellowship investigates missing caravans near an ancient road.",
      "dm_private_notes_available": true
    },
    "world_setting": {
      "genre": "heroic fantasy",
      "tone": "hopeful but dangerous",
      "summary": "Ancient kingdoms, fading magic, and contested roads."
    },
    "adventure": {
      "quests": [],
      "maps": [],
      "important_npcs": []
    },
    "characters": [],
    "monsters": [],
    "rules": {
      "dice_system": "d20",
      "combat_model": "turn_based"
    },
    "items": [],
    "created_at": "2026-05-27T10:00:00.000Z",
    "updated_at": "2026-05-27T10:08:00.000Z"
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| Game 不存在 | 404 | 4041001 | 查询不到对应 game |
| DM 私有字段无权限 | 403 | 4031001 | 缺少读取私有资料权限 |

### 4.4 Game Runtime API

#### 4.4.1 Start Runtime

- **方法**：`POST`
- **路径**：`/games/{game_id}/runtime`
- **说明**：基于已生成游戏启动 DM runtime session。服务端负责创建 DM session 和必要的 NPC subagent session。

请求体：

```json
{
  "player_character_ids": ["char_01jz8dnddemo0000000001"],
  "mode": "runtime",
  "create_important_npc_sessions": true
}
```

| 参数名 | 类型 | 必填 | 说明 | 约束/示例 |
|---|---|---:|---|---|
| player_character_ids | string[] | 是 | 参与角色 ID | 至少 1 个 |
| mode | string | 是 | 运行模式 | `runtime` |
| create_important_npc_sessions | boolean | 否 | 是否创建重要 NPC subagent session | `true` |

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "runtime_id": "rt_01jz8dnddemo000000000001",
    "game_id": "game_01jz8dnddemo00000000001",
    "dm_session_id": "ses_01jz8dnddemo000000000010",
    "status": "active",
    "scene": {
      "id": "scene_roadside_inn",
      "name": "Roadside Inn",
      "round": 0,
      "turn_order": []
    },
    "created_at": "2026-05-27T10:10:00.000Z"
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| Game 未 ready | 409 | 4091001 | game 必须先完成生成和校验 |
| 角色不存在 | 404 | 4041001 | 至少一个角色 ID 不存在 |

#### 4.4.2 Get Runtime State

- **方法**：`GET`
- **路径**：`/runtime/{runtime_id}/state`
- **说明**：读取当前场景、角色、NPC、背包、状态、回合和掷骰结果。

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "runtime_id": "rt_01jz8dnddemo000000000001",
    "game_id": "game_01jz8dnddemo00000000001",
    "version": 3,
    "status": "active",
    "scene": {
      "id": "scene_roadside_inn",
      "name": "Roadside Inn",
      "description": "Rain taps against the shutters while travelers whisper over cold stew.",
      "dm_private_notes": null,
      "round": 1,
      "turn_order": ["char_01jz8dnddemo0000000001", "npc_01jz8dnddemo00000000001"]
    },
    "characters": [],
    "npcs": [],
    "dice_results": [],
    "updated_at": "2026-05-27T10:12:00.000Z"
  }
}
```

失败场景：

| 场景 | HTTP 状态码 | 业务码 | 说明 |
|---|---:|---:|---|
| Runtime 不存在 | 404 | 4041001 | 查询不到 runtime |
| DM 私有状态无权限 | 403 | 4031001 | 缺少读取私有状态权限 |

---

## 5. WebSocket Event 协议

### 5.1 连接

- **路径**：`/ws`
- **鉴权**：使用 `Authorization: Bearer <access_token>`；本地开发可使用 `access_token` query 参数。
- **订阅**：连接建立后客户端发送订阅消息。

订阅示例：

```json
{
  "type": "subscribe",
  "request_id": "req_ws_001",
  "payload": {
    "game_ids": ["game_01jz8dnddemo00000000001"],
    "session_ids": ["ses_01jz8dnddemo000000000010"],
    "runtime_ids": ["rt_01jz8dnddemo000000000001"]
  }
}
```

### 5.2 通用事件信封

```json
{
  "type": "message.created",
  "event_id": "evt_01jz8dnddemo000000000001",
  "request_id": "req_ws_001",
  "occurred_at": "2026-05-27T10:12:00.000Z",
  "payload": {}
}
```

| 字段名 | 类型 | 说明 |
|---|---|---|
| type | string | 事件类型 |
| event_id | string | 事件唯一 ID，用于去重 |
| request_id | string/null | 请求关联 ID |
| occurred_at | string | 事件发生时间 |
| payload | object | 事件载荷 |

### 5.3 事件类型

| Event type | 说明 | Payload |
|---|---|---|
| `message.created` | 新聊天消息已写入 | `ChatMessage` |
| `agent.status_changed` | Agent 运行状态变化 | `{ "session_id": "ses_...", "run_id": "run_...", "status": "queued|running|idle|failed" }` |
| `runtime.state_updated` | 运行时状态更新 | `RuntimeState` 或增量 patch |
| `runtime.scene_updated` | 当前场景更新 | `SceneState` |
| `error` | WebSocket 错误 | 通用错误对象 |

Agent 状态事件示例：

```json
{
  "type": "agent.status_changed",
  "event_id": "evt_01jz8dnddemo000000000002",
  "request_id": "req_ws_001",
  "occurred_at": "2026-05-27T10:12:05.000Z",
  "payload": {
    "session_id": "ses_01jz8dnddemo000000000010",
    "run_id": "run_01jz8dnddemo000000000010",
    "status": "running"
  }
}
```

错误事件示例：

```json
{
  "type": "error",
  "event_id": "evt_01jz8dnddemo000000000099",
  "request_id": "req_ws_001",
  "occurred_at": "2026-05-27T10:12:05.000Z",
  "payload": {
    "code": 4011001,
    "message": "authentication failed"
  }
}
```

---

## 6. DND 游戏数据对象说明

### 6.1 Session

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Session ID |
| agent_type | string | `builder`, `dm` |
| mode | string | `creation`, `runtime` |
| title | string/null | 标题 |
| metadata | object | game 或 runtime 关联信息 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

### 6.2 ChatMessage

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Message ID |
| session_id | string | 所属 session |
| sender | SenderIdentity | 发送方 |
| visibility | string | `public`, `dm_only`, `npc_private`, `private_to_player` |
| content_type | string | `text`, `system`, `tool_result`, `state_summary` |
| content | string | 消息正文 |
| metadata | object | 结构化元数据 |
| created_at | string | 创建时间 |

### 6.3 SenderIdentity

| 字段名 | 类型 | 说明 |
|---|---|---|
| role | string | `user`, `agent`, `npc`, `system`, `tool` |
| name | string | 展示名称 |
| agent_type | string/null | Agent 类型 |
| npc_id | string/null | NPC ID |

### 6.4 Game

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Game ID |
| api_version | string | 当前为 `v1` |
| status | string | `creating`, `validating`, `ready`, `failed`, `archived` |
| title | string | 游戏标题 |
| world_setting | WorldSetting | 世界设定 |
| adventure | AdventureOutline | 冒险结构 |
| characters | CharacterInfo[] | 可选或已加入角色 |
| monsters | Monster[] | 怪物图鉴 |
| rules | Rules | 骰子、战斗、状态和互动规则 |
| items | Item[] | 物品列表 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

示例：

```json
{
  "id": "game_01jz8dnddemo000000000001",
  "api_version": "v1",
  "status": "ready",
  "title": "Shadows Over Bree",
  "world_setting": {
    "genre": "heroic fantasy",
    "tone": "grounded and mysterious",
    "summary": "A border town is threatened by disappearances near an old watchtower.",
    "factions": [],
    "dm_private_lore": []
  },
  "adventure": {
    "premise": "Investigate the missing scouts before the harvest moon.",
    "quests": [],
    "maps": [],
    "important_npcs": [],
    "hidden_clues": [],
    "opening_scene_id": "scene_bree_gate"
  },
  "characters": [],
  "monsters": [],
  "rules": {
    "dice_system": "d20",
    "ability_checks": [],
    "combat_model": "turn_based",
    "combat_actions": [],
    "status_effects": [],
    "damage_types": ["slashing", "fire", "psychic"]
  },
  "items": [],
  "created_at": "2026-05-27T10:00:00.000Z",
  "updated_at": "2026-05-27T10:15:00.000Z"
}
```

### 6.5 WorldSetting

| 字段名 | 类型 | 说明 |
|---|---|---|
| genre | string | 游戏类型，例如 `heroic fantasy` |
| tone | string | DM 叙事风格 |
| summary | string | 玩家可见世界摘要 |
| factions | object[] | 阵营及公开动机 |
| dm_private_lore | object[] | DM 私有背景知识 |

### 6.6 AdventureOutline

| 字段名 | 类型 | 说明 |
|---|---|---|
| premise | string | 玩家可见冒险前提 |
| quests | Quest[] | 主线和支线任务 |
| maps | MapInfo[] | 地图和场景引用 |
| important_npcs | NPCInfo[] | 由 subagent 承载的重要 NPC |
| hidden_clues | HiddenClue[] | 隐藏线索与揭示条件 |
| opening_scene_id | string | 初始场景 ID |

### 6.7 MapInfo

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Map ID |
| name | string | 地图或场景名称 |
| kind | string | `region`, `settlement`, `dungeon`, `battlemap`, `scene` |
| description | string | 玩家可见描述 |
| asset_path | string/null | 相对资源路径，例如 `assets/maps/bree_gate.png` |
| locations | object[] | 地图中的关键地点，每项包含 `id`、`name`、`description` |
| dm_private_notes | string/null | DM 私有地图信息 |

示例：

```json
{
  "id": "map_bree_gate",
  "name": "Bree North Gate",
  "kind": "battlemap",
  "description": "A muddy road passes through a timber gate watched by two lanterns.",
  "asset_path": "assets/maps/bree_gate.png",
  "locations": [
    {
      "id": "loc_guard_post",
      "name": "Guard Post",
      "description": "A cramped booth with a ledger and rain-soaked cloaks."
    }
  ],
  "dm_private_notes": "The western lantern hides a coded marker from the smugglers."
}
```

### 6.8 HiddenClue

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Clue ID |
| summary | string | 线索摘要 |
| reveal_condition | string | 揭示条件，例如检定、对话或探索动作 |
| target_audience | string | `dm`, `party`, `character`, `npc` |
| related_entity_ids | string[] | 关联任务、地图、NPC 或物品 ID |
| revealed | boolean | 当前运行时是否已揭示 |

示例：

```json
{
  "id": "clue_black_arrow",
  "summary": "The missing scouts followed a black-feathered arrow marker.",
  "reveal_condition": "DC 13 Wisdom (Perception) check near loc_guard_post",
  "target_audience": "party",
  "related_entity_ids": ["quest_missing_scouts", "map_bree_gate"],
  "revealed": false
}
```

### 6.9 Quest

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Quest ID |
| title | string | 任务标题 |
| player_visible_goal | string | 玩家可见目标 |
| dm_private_goal | string/null | DM 私有目标或反转 |
| success_conditions | string[] | 成功条件 |
| failure_conditions | string[] | 失败条件 |
| rewards | Item[] | 奖励 |

### 6.10 CharacterInfo

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Character ID |
| name | string | 名称 |
| ancestry | string | 种族或血统 |
| class_name | string | 职业或原型 |
| level | integer | 等级 |
| stats | CharacterStats | 属性和战斗数值 |
| hp | HitPoints | 当前、最大和临时生命值 |
| inventory | Item[] | 背包 |
| conditions | string[] | 当前状态 |
| public_background | string | 玩家可见背景 |
| private_notes | string/null | DM 私有说明 |

### 6.11 CharacterStats

| 字段名 | 类型 | 说明 |
|---|---|---|
| strength | integer | 力量 |
| dexterity | integer | 敏捷 |
| constitution | integer | 体质 |
| intelligence | integer | 智力 |
| wisdom | integer | 感知 |
| charisma | integer | 魅力 |
| armor_class | integer | 护甲等级 |
| proficiency_bonus | integer | 熟练加值 |

### 6.12 HitPoints

| 字段名 | 类型 | 说明 |
|---|---|---|
| current | integer | 当前生命值，不能小于 0 |
| max | integer | 最大生命值 |
| temporary | integer | 临时生命值 |
| death_saves | object/null | 濒死豁免状态，包含 `successes` 和 `failures` |

示例：

```json
{
  "current": 18,
  "max": 24,
  "temporary": 3,
  "death_saves": {
    "successes": 0,
    "failures": 0
  }
}
```

### 6.13 Item

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Item ID |
| name | string | 物品名称 |
| category | string | `weapon`, `armor`, `consumable`, `tool`, `treasure`, `quest` |
| description | string | 玩家可见描述 |
| quantity | integer | 数量 |
| weight | number/null | 单件重量 |
| value | object/null | 价值，包含 `amount` 和 `currency` |
| properties | string[] | 物品标签或规则属性 |
| effects | string[] | 使用或装备效果 |
| dm_private_notes | string/null | DM 私有说明 |

示例：

```json
{
  "id": "item_black_arrow",
  "name": "Black-Feathered Arrow",
  "category": "quest",
  "description": "An arrow fletched with glossy black feathers.",
  "quantity": 1,
  "weight": 0.05,
  "value": null,
  "properties": ["evidence", "crafted"],
  "effects": ["Advantage on checks to identify the archer's faction."],
  "dm_private_notes": "Made by a ranger cell loyal to the antagonist."
}
```

### 6.14 NPCInfo

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | NPC ID |
| name | string | NPC 名称 |
| public_identity | string | 公开身份 |
| personality | string | 稳定性格 |
| alignment | string | 阵营或派系立场 |
| private_goal | string | 私有目标 |
| known_information | string[] | NPC 初始已知信息 |
| relationship_network | object[] | 与角色、派系或 NPC 的关系 |
| memory_session_id | string/null | 保存记忆的 subagent session |
| can_reply_publicly | boolean | 是否允许写入主 chat |

### 6.15 Monster

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Monster ID |
| name | string | 名称 |
| challenge_rating | string | 相对挑战等级 |
| stats | CharacterStats | 怪物属性 |
| hp | HitPoints | 生命值 |
| actions | CombatAction[] | 可用战斗动作 |
| loot | Item[] | 掉落或奖励 |
| tactics | string | DM 使用策略 |

### 6.16 CombatAction

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Action ID |
| name | string | 动作名称 |
| action_type | string | `action`, `bonus_action`, `reaction`, `legendary`, `free` |
| cost | string | 行动消耗说明 |
| range | string | 距离或范围 |
| target | string | 目标选择规则 |
| attack_bonus | integer/null | 攻击加值；非攻击动作可为 null |
| save_dc | integer/null | 豁免 DC；不需要豁免时为 null |
| damage | string/null | 伤害表达式，例如 `1d8+3 slashing` |
| effects | string[] | 命中、失败或使用后的效果 |
| description | string | 规则描述 |

示例：

```json
{
  "id": "action_longsword",
  "name": "Longsword Strike",
  "action_type": "action",
  "cost": "one action",
  "range": "5 ft",
  "target": "one creature",
  "attack_bonus": 5,
  "save_dc": null,
  "damage": "1d8+3 slashing",
  "effects": ["On hit, the target takes slashing damage."],
  "description": "Make a melee weapon attack against one adjacent target."
}
```

### 6.17 StatusEffect

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Status Effect ID |
| name | string | 状态名称 |
| description | string | 玩家可见规则说明 |
| duration | string | 持续时间，例如 `1 minute` 或 `until saved` |
| stackable | boolean | 是否可叠加 |
| mechanical_effects | string[] | 数值或规则影响 |
| removal_conditions | string[] | 移除条件 |

示例：

```json
{
  "id": "effect_frightened",
  "name": "Frightened",
  "description": "The creature is shaken by a visible threat.",
  "duration": "until end of next turn or successful save",
  "stackable": false,
  "mechanical_effects": [
    "Disadvantage on ability checks while the source is visible.",
    "Cannot willingly move closer to the source of fear."
  ],
  "removal_conditions": ["Succeed on a Wisdom saving throw at the end of the turn."]
}
```

### 6.18 Rules

| 字段名 | 类型 | 说明 |
|---|---|---|
| dice_system | string | 骰子系统，例如 `d20` |
| ability_checks | object[] | 检定规则与 DC 指引 |
| combat_model | string | 战斗流程，例如 `turn_based` |
| combat_actions | CombatAction[] | 支持的战斗动作 |
| status_effects | StatusEffect[] | 支持的状态效果 |
| damage_types | string[] | 伤害类型 |

### 6.19 DiceRollResult

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Roll ID |
| expression | string | 掷骰表达式 |
| rolls | integer[] | 单个骰子结果 |
| modifier | integer | 固定修正总值 |
| total | integer | 最终结果 |
| reason | string/null | 掷骰原因 |
| roller | object | 掷骰者 |
| visibility | string | `public`, `dm_only`, `private_to_player` |
| created_at | string | 创建时间 |

### 6.20 RuntimeState

| 字段名 | 类型 | 说明 |
|---|---|---|
| runtime_id | string | Runtime ID |
| game_id | string | Game ID |
| version | integer | 乐观锁版本 |
| status | string | `active`, `paused`, `completed`, `failed` |
| scene | SceneState | 当前场景 |
| characters | CharacterInfo[] | 当前玩家角色 |
| npcs | NPCInfo[] | 当前运行时 NPC |
| dice_results | DiceRollResult[] | 最近掷骰结果 |
| updated_at | string | 更新时间 |

### 6.21 SceneState

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | string | Scene ID |
| name | string | 场景名称 |
| description | string | 玩家可见场景描述 |
| dm_private_notes | string/null | DM 私有场景说明 |
| map_id | string/null | 关联地图 ID |
| round | integer | 当前回合或场景轮次 |
| turn_order | string[] | 角色和 NPC 行动顺序 |
| objects | object[] | 可交互场景对象 |

### 6.22 版本兼容策略

- 小版本可新增可选字段，不改变 `api_version`。
- 破坏性变更必须使用新版本路径，例如 `/api/v2`。
- `api_version: "v1"` 的游戏数据必须保持可读。
- 客户端必须忽略未知字段，不依赖对象字段顺序。

---

## 7. 变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1.0.2 | 2026-05-27 | 收敛公开 API：删除 Workspace API、Create Session、Validate Game、Submit Player Action、Roll Dice、Update Runtime State 和 Notify NPC，明确 workspace 为后端内部实现细节。 |
| v1.0.1 | 2026-05-27 | 移除 Workspace API 的服务端路径暴露，统一 Session 过滤参数为 `agent_type`，补充核心 DND 对象字段和示例。 |
| v1.0.0 | 2026-05-27 | 初始版本，覆盖 Workspace、Session、Chat、Game Creation、Game Runtime、WebSocket、鉴权、状态码、错误码和 DND 数据对象。 |
