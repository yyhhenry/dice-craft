# DiceCraft - Workspace & Session 设计计划

## Context

Subagent 系统已完成。现在需要设计 Workspace 和 Session 系统：
- 让 Agent 在受控环境中进行文件操作（read/write/edit/grep/glob）
- 支持多用户、多工作区、多对话
- Session 持久化与恢复（包括 subagent session）
- Skill 作为普通文件放在 agent 目录内

参考 opencode 的架构，但简化实现：**纯 JSON/JSONL 存储，不依赖 SQLite**。

## 设计目标

1. **CLI 默认 Workspace**：调试阶段使用 `workspace/cli` 作为默认工作区
2. **Agent 可修改目录**：workspace 下 `agent/` 目录供 Agent 自由修改
3. **Skill 作为普通文件**：放在 `agent/skills/` 下，预制 skill 通过 Bun macro 内嵌，创建时写入
4. **多用户支持**：每个用户有独立的 user ID，可创建多个工作区
5. **多对话管理**：每个工作区下可创建多个 session（对话）
6. **Session 持久化**：对话数据以 JSON/JSONL 格式存储到 `data/` 目录
7. **Subagent 持久化**：subagent session 与主 session 统一格式存储
8. **Session 恢复**：重启后可恢复之前的对话状态

## 整体目录结构

```
项目根目录/
├── src/
│   ├── assembly.ts               # 组装模块：创建 model、注册 agent/tool、返回 App
│   ├── workspace/
│   │   ├── types.ts              # 类型定义
│   │   ├── manager.ts            # Workspace 管理器
│   │   ├── guard.ts              # 路径权限检查
│   │   └── templates.macro.ts    # Bun macro：内嵌预制 skill 模板
│   ├── session/
│   │   ├── types.ts              # 类型定义
│   │   ├── manager.ts            # Session 管理器
│   │   └── store.ts              # JSON/JSONL 文件存储
│   ├── agent/
│   │   ├── index.ts              # 导出
│   │   ├── registry.ts           # AgentRegistry + loadAgents()
│   │   ├── loop.ts               # AgentLoop
│   │   ├── subagent.ts           # SubagentDispatcher
│   │   └── prompt/               # Agent prompt（静态 import）
│   ├── tool/
│   │   ├── index.ts              # 导出
│   │   ├── base.ts               # Tool 接口 + ToolRegistry
│   │   ├── builtin.ts            # loadBuiltinTools()
│   │   ├── time.ts               # get_current_time
│   │   └── task.ts               # spawn_subagent
│   └── index.ts                  # CLI 入口（REPL loop）
├── templates/                    # 预制 skill 模板（git 追踪，后续阶段添加内容）
│   └── skills/                   # 当前为空目录
├── workspace/                    # 运行时 workspace（.gitignore）
│   └── cli/
│       └── agent/
│           └── skills/
├── data/                         # 持久化数据（.gitignore）
│   ├── users/<userId>/
│   ├── workspaces/<workspaceId>/
│   └── sessions/<sessionId>/
└── ...
```

## 核心设计

### 1. ID 生成

```typescript
// src/workspace/types.ts
type UserID = string       // "user_<uuid8>"
type WorkspaceID = string  // "ws_<uuid8>"
type SessionID = string    // "sess_<timestamp>_<uuid6>"
```

### 2. Bun Macro：预制 Skill 模板（后续阶段实现）

**当前阶段**：创建 workspace 时只创建空的 `agent/skills/` 目录，不预制任何 skill。

**后续阶段**：通过 Bun macro 将预制 skill 模板内嵌到 bundle 中。

**Bun macro 工作原理**：
- 宏文件是一个 `.macro.ts` 文件，里面 `export` 的函数在 **bundle-time** 执行
- 运行时代码中 `import { fn } from "./xxx.macro.ts" with { type: "macro" }` 后调用 `fn()`
- Bun bundler 会把 `fn()` 调用**直接替换为返回值的字面量**，运行时不再有函数调用
- 返回值必须是 JSON 可序列化的（string, number, object, array 等）

```typescript
// src/workspace/templates.macro.ts  （宏文件，bundle-time 执行）
import fs from "fs"
import path from "path"
import matter from "gray-matter"

export interface SkillTemplate {
  name: string
  description: string
  content: string
}

// 这个函数在 bundle 时执行，读取文件系统
// 运行时代码中调用处会被替换为返回值的 JSON 字面量
export function loadSkillTemplates(): SkillTemplate[] {
  const skillsDir = path.resolve(import.meta.dir, "../../templates/skills")
  if (!fs.existsSync(skillsDir)) return []
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory())
    .map(dir => {
      const skillMd = path.join(skillsDir, dir.name, "SKILL.md")
      if (!fs.existsSync(skillMd)) return null
      const content = fs.readFileSync(skillMd, "utf-8")
      const { data } = matter(content)
      return { name: data.name ?? dir.name, description: data.description ?? "", content }
    })
    .filter(Boolean) as SkillTemplate[]
}
```

```typescript
// src/workspace/manager.ts  （运行时代码）
import { loadSkillTemplates } from "./templates.macro" with { type: "macro" }

// bundle 后，这行变成：const BUILTIN_SKILLS = [{name:"dice-roller",...}, ...]
// 运行时没有函数调用，直接是字面量
const BUILTIN_SKILLS = loadSkillTemplates()

function writeSkillTemplates(agentDir: string): void {
  if (BUILTIN_SKILLS.length === 0) return
  const skillsDir = path.join(agentDir, "skills")
  for (const skill of BUILTIN_SKILLS) {
    const dir = path.join(skillsDir, skill.name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "SKILL.md"), skill.content)
  }
}
```

**计划中的预制 skill**（后续阶段添加到 `templates/skills/`）：
- `dice-roller`：掷骰子工具
- 可能有桌游相关的 skill（如 npc-generator、world-builder 等）

### 3. Workspace 管理器

```typescript
// src/workspace/types.ts
interface Workspace {
  id: WorkspaceID
  name: string
  ownerId: UserID
  path: string              // workspace/<wsId>/
  agentDir: string          // workspace/<wsId>/agent/
  skillsDir: string         // workspace/<wsId>/agent/skills/
  createdAt: string
}

// src/workspace/manager.ts
class WorkspaceManager {
  private baseDir: string
  private workspaces: Map<WorkspaceID, Workspace>

  // CLI 初始化：创建或恢复默认 workspace
  initCLI(): Workspace

  // 创建新 workspace（写入预制 skill）
  create(ownerId: UserID, name: string): Workspace

  get(id: WorkspaceID): Workspace | undefined
  listByUser(userId: UserID): Workspace[]
  delete(id: WorkspaceID): void
}
```

### 4. Session 与 Message（统一格式）

主 agent 和 subagent 的消息都是 `ChatCompletionMessageParam[]`，存储格式统一。

```typescript
// src/session/types.ts

// 存储到 JSONL 的消息格式（与 OpenAI ChatCompletionMessageParam 兼容）
interface StoredMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  name?: string
  // 元数据
  _meta?: {
    id: string
    timestamp: string
    subagent_id?: string  // 标记来自哪个 subagent
  }
}

interface Session {
  id: SessionID
  workspaceId: WorkspaceID
  parentSessionId?: SessionID  // subagent 的父 session
  title: string
  agentType: string             // "primary" | "explore" | "general" | ...
  systemPrompt?: string         // 使用的 system prompt
  createdAt: string
  updatedAt: string
  messageCount: number
}
```

**存储结构**：

```
data/sessions/<sessionId>/
├── info.json               # Session 元信息
└── messages.jsonl           # 消息记录（追加写入）
```

**info.json**：

```json
{
  "id": "sess_1716500000_abc123",
  "workspaceId": "ws_def456",
  "parentSessionId": null,
  "title": "帮我写一个贪吃蛇游戏",
  "agentType": "primary",
  "systemPrompt": "You are a helpful game dev assistant...",
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:05:00Z",
  "messageCount": 6
}
```

**messages.jsonl**（每行一个 JSON，追加写入）：

```jsonl
{"role":"user","content":"帮我写一个贪吃蛇游戏","_meta":{"id":"msg_001","timestamp":"2026-05-24T10:00:00Z"}}
{"role":"assistant","content":null,"tool_calls":[{"id":"call_001","type":"function","function":{"name":"spawn_subagent","arguments":"{\"agent_type\":\"general\",\"prompt\":\"创建贪吃蛇游戏\"}"}}],"_meta":{"id":"msg_002","timestamp":"2026-05-24T10:00:05Z"}}
{"role":"tool","content":"Subagent sess_sub_001 completed. Result: 已创建游戏...","tool_call_id":"call_001","_meta":{"id":"msg_003","timestamp":"2026-05-24T10:00:10Z"}}
{"role":"assistant","content":"已创建贪吃蛇游戏，请查看 agent/snake-game/","_meta":{"id":"msg_004","timestamp":"2026-05-24T10:00:15Z"}}
```

### 5. Subagent 持久化

Subagent session 和主 session 使用**完全相同的存储格式**，区别在于：
- `info.json` 中 `parentSessionId` 指向父 session
- `info.json` 中 `agentType` 标识 agent 类型
- 父 session 的 tool result 中引用 subagent session ID

```
data/sessions/
├── sess_1716500000_abc123/          # 主 session
│   ├── info.json
│   └── messages.jsonl
└── sess_sub_1716500100_xyz789/      # subagent session
    ├── info.json
    └── messages.jsonl
```

**Subagent info.json**：

```json
{
  "id": "sess_sub_1716500100_xyz789",
  "workspaceId": "ws_def456",
  "parentSessionId": "sess_1716500000_abc123",
  "title": "创建贪吃蛇游戏",
  "agentType": "general",
  "systemPrompt": "You are a helpful assistant...",
  "createdAt": "2026-05-24T10:00:05Z",
  "updatedAt": "2026-05-24T10:00:10Z",
  "messageCount": 3
}
```

### 6. Session 管理器

```typescript
// src/session/manager.ts
class SessionManager {
  private store: SessionStore

  // 创建新对话
  create(opts: {
    workspaceId: WorkspaceID
    agentType: string
    systemPrompt?: string
    title?: string
    parentSessionId?: SessionID  // subagent 时指定
  }): Session

  // 获取 session
  get(id: SessionID): Session | undefined

  // 列出 workspace 下的主 session（不含 subagent）
  listByWorkspace(workspaceId: WorkspaceID): Session[]

  // 列出 session 的 subagent sessions
  listSubagents(parentSessionId: SessionID): Session[]

  // 追加消息
  appendMessage(sessionId: SessionID, message: StoredMessage): void

  // 读取所有消息（用于恢复）
  getMessages(sessionId: SessionID): StoredMessage[]

  // 获取 workspace 的最近 session（用于 CLI 恢复）
  getLastSession(workspaceId: WorkspaceID): Session | undefined

  // 删除 session（同时删除 subagent sessions）
  delete(id: SessionID): void
}
```

### 7. Session 存储层

```typescript
// src/session/store.ts
class SessionStore {
  private baseDir: string  // data/

  // === Session ===
  readSessionInfo(sessionId: SessionID): Session | undefined
  writeSessionInfo(session: Session): void

  // === Messages (JSONL) ===
  appendMessage(sessionId: SessionID, message: StoredMessage): void
  readMessages(sessionId: SessionID): StoredMessage[]

  // === Workspace 索引 ===
  listWorkspaceSessions(workspaceId: WorkspaceID): SessionID[]
  addSessionToWorkspace(workspaceId: WorkspaceID, sessionId: SessionID): void
  removeSessionFromWorkspace(workspaceId: WorkspaceID, sessionId: SessionID): void

  // === 清理 ===
  deleteSession(sessionId: SessionID): void
}
```

### 8. SubagentDispatcher 改造

```typescript
// src/agent/subagent.ts
class SubagentDispatcher {
  private model: OpenAIModel
  private toolRegistry: ToolRegistry
  private agentRegistry: AgentRegistry
  private sessionManager: SessionManager  // 新增依赖
  private activeLoops = new Map<string, AgentLoop>()

  async spawn(
    parentSessionId: SessionID,
    agentName: string,
    prompt: string,
    options: SpawnOptions = {}
  ): Promise<SubagentResult> {
    const agentInfo = this.agentRegistry.get(agentName)

    // 创建 subagent session（持久化）
    const session = this.sessionManager.create({
      workspaceId: this.getWorkspaceId(parentSessionId),
      agentType: agentName,
      systemPrompt: agentInfo.systemPrompt,
      title: prompt.slice(0, 50),
      parentSessionId,
    })

    // 记录用户消息
    this.sessionManager.appendMessage(session.id, {
      role: "user",
      content: prompt,
      _meta: { id: generateMsgId(), timestamp: new Date().toISOString() }
    })

    const loop = new AgentLoop(this.model, this.toolRegistry, {
      systemPrompt: agentInfo.systemPrompt,
    })

    if (options.background) {
      this.activeLoops.set(session.id, loop)
      loop.run(prompt, []).then(({ history }) => {
        this.persistHistory(session.id, history)
      })
      return { content: "", sessionId: session.id }
    }

    const { response, history } = await loop.run(prompt, [])
    this.persistHistory(session.id, history)
    return { content: response, sessionId: session.id }
  }

  // 恢复 subagent（从持久化数据重建内存状态）
  restore(sessionId: SessionID): void {
    const messages = this.sessionManager.getMessages(sessionId)
    const session = this.sessionManager.get(sessionId)
    // 去掉第一条 user message（prompt），剩下的是 history
    const history = messages.slice(1).map(m => toChatCompletion(m))
    // 可以用 history 继续 send()
  }

  private persistHistory(sessionId: SessionID, history: ChatCompletionMessageParam[]): void {
    for (const msg of history) {
      this.sessionManager.appendMessage(sessionId, {
        ...msg,
        _meta: { id: generateMsgId(), timestamp: new Date().toISOString() }
      })
    }
  }
}
```

### 9. Workspace Guard

```typescript
// src/workspace/guard.ts
class WorkspaceGuard {
  constructor(private workspacePath: string) {}

  assertWithinWorkspace(filepath: string): void {
    const resolved = this.resolvePath(filepath)
    const relative = path.relative(this.workspacePath, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Access denied: ${filepath} is outside workspace`)
    }
  }

  resolvePath(filepath: string): string {
    if (path.isAbsolute(filepath)) return filepath
    return path.resolve(this.workspacePath, filepath)
  }
}
```

### 10. CLI 启动与恢复流程

```typescript
// src/index.ts
async function main() {
  const workspaceManager = new WorkspaceManager("workspace")
  const sessionManager = new SessionManager(new SessionStore("data"))
  const subagentDispatcher = new SubagentDispatcher(model, toolRegistry, agentRegistry, sessionManager)

  // 1. 创建或恢复 CLI workspace
  const workspace = workspaceManager.initCLI()

  // 2. 恢复上次 session
  const lastSession = sessionManager.getLastSession(workspace.id)
  if (lastSession) {
    const messages = sessionManager.getMessages(lastSession.id)
    agentLoop.setHistory(messages)

    // 3. 恢复 subagent sessions
    const subagents = sessionManager.listSubagents(lastSession.id)
    for (const sub of subagents) {
      subagentDispatcher.restore(sub.id)
    }
  }

  // 4. 开始交互循环
  await runREPL(workspace, sessionManager, agentLoop)
}
```

## 实现步骤

### Phase 1: Workspace 基础

| 文件 | 内容 |
|------|------|
| `src/workspace/types.ts` | UserID, WorkspaceID, SessionID 类型 |
| `src/workspace/guard.ts` | WorkspaceGuard 路径权限 |
| `src/workspace/manager.ts` | WorkspaceManager，含 initCLI、create（创建空的 agent/skills/ 目录）|

> 注意：当前阶段只创建空的 `agent/skills/` 目录，不预制任何 skill。

### Phase 2: Session 存储

| 文件 | 内容 |
|------|------|
| `src/session/types.ts` | Session, StoredMessage 类型 |
| `src/session/store.ts` | JSON/JSONL 文件读写 |
| `src/session/manager.ts` | SessionManager CRUD + subagent 索引 |

### Phase 3: Subagent 改造

| 文件 | 内容 |
|------|------|
| `src/agent/subagent.ts` | 依赖 SessionManager，spawn 时持久化，支持 restore |

### Phase 4: 文件操作工具

| 文件 | 内容 |
|------|------|
| `src/tool/read.ts` | 读取文件，offset/limit |
| `src/tool/write.ts` | 写入文件 |
| `src/tool/edit.ts` | 编辑文件 |

### Phase 5: 搜索工具

| 文件 | 内容 |
|------|------|
| `src/tool/glob.ts` | Glob 搜索 |
| `src/tool/grep.ts` | 正则搜索 |
| `src/tool/skill.ts` | 在 agent/skills/ 下搜索 SKILL.md |

### Phase 6: 集成

| 文件 | 内容 |
|------|------|
| `src/index.ts` | CLI 启动、恢复、注册工具 |

### Phase 7: 测试

- Workspace 创建（验证 agent/skills/ 目录创建）
- Session CRUD + 消息追加
- Subagent spawn → 持久化 → 恢复
- 路径越界拒绝
- 文件操作工具
- Skill 发现

### Phase 8（后续）: 预制 Skill 模板

| 文件 | 内容 |
|------|------|
| `src/workspace/templates.macro.ts` | Bun macro，bundle-time 读取 templates/skills/ |
| `templates/skills/dice-roller/SKILL.md` | 掷骰子 skill |
| 其他桌游相关 skill | 后续按需添加（如 npc-generator、world-builder 等）|

此阶段需要：
1. 创建 `.macro.ts` 文件，export 函数读取文件系统返回 `SkillTemplate[]`
2. 在 `manager.ts` 中 `import { loadSkillTemplates } from "./templates.macro" with { type: "macro" }`
3. 创建 workspace 时调用 `writeSkillTemplates(agentDir)` 将内嵌的模板写入目录
4. 添加预制 skill 内容到 `templates/skills/`

## 关键设计决策

1. **Bun macro 内嵌模板（后续阶段）**：`templates/skills/` 在 bundle-time 读取并内嵌，当前阶段只创建空目录
2. **统一消息格式**：主 session 和 subagent 都用 `StoredMessage`（兼容 `ChatCompletionMessageParam`）
3. **Subagent 就是 session**：subagent 有自己的 `info.json` + `messages.jsonl`，通过 `parentSessionId` 关联
4. **JSONL 追加写入**：消息追加到 `.jsonl`，不修改已有内容
5. **直接失败，不询问用户**：超出 workspace 范围直接报错
6. **CLI 自动恢复**：重启后恢复主 session + 所有 subagent 状态

## 验证方式

1. `bun run check` 全部通过
2. CLI 启动 → workspace/cli/ 目录创建 + 空的 agent/skills/ 目录
3. 对话 → session 持久化到 data/sessions/
4. spawn subagent → subagent session 持久化
5. 重启 → 恢复主 session + subagent
6. 路径越界 → 报错
7. read/write/edit/glob/grep 工具正常
8. SKILL.md 发现正常

## 依赖

- `gray-matter`：解析 SKILL.md frontmatter
- `glob` 或 `fast-glob`：文件搜索
- `ripgrep`（系统依赖）：内容搜索
- `crypto`（内置）：UUID 生成

## 参考文件

- `references/opencode/packages/opencode/src/tool/read.ts` - Read 工具
- `references/opencode/packages/opencode/src/tool/write.ts` - Write 工具
- `references/opencode/packages/opencode/src/tool/edit.ts` - Edit 工具
- `references/opencode/packages/opencode/src/tool/glob.ts` - Glob 工具
- `references/opencode/packages/opencode/src/tool/grep.ts` - Grep 工具
- `references/opencode/packages/opencode/src/storage/storage.ts` - JSON 存储
- `references/opencode/packages/opencode/src/session/session.ts` - Session 管理
