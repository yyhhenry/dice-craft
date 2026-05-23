# DiceCraft - Workspace 设计计划

## Context

Subagent 系统已完成。现在需要设计 Workspace 系统，让 Agent 能够在受控环境中进行文件操作（read/write/edit/grep/glob）。

参考 opencode 的工具实现，但简化权限模型：**只允许操作 workspace 内的文件，超出范围直接失败，不询问用户**。

## 设计目标

1. **独立 Workspace**：每次用户交互创建独立的 workspace 目录
2. **受限文件操作**：所有工具限制在 workspace 目录内
3. **Skill 发现**：`**/SKILL.md` 自动识别为 skill
4. **工具复用**：read/write/edit/grep/glob 工具可被 subagent 使用

## 目录结构

```
src/
├── workspace/
│   ├── manager.ts        # Workspace 管理器
│   └── guard.ts          # 路径权限检查
├── tool/
│   ├── base.ts           # Tool 接口（已有）
│   ├── time.ts           # get_current_time（已有）
│   ├── task.ts           # spawn_subagent（已有）
│   ├── read.ts           # 读取文件
│   ├── write.ts          # 写入文件
│   ├── edit.ts           # 编辑文件
│   ├── glob.ts           # 文件搜索
│   ├── grep.ts           # 内容搜索
│   └── skill.ts          # 列出可用 skills
└── ...
```

## 核心设计

### Workspace 管理器

```typescript
// src/workspace/manager.ts
interface Workspace {
  id: string
  path: string       // 绝对路径
  createdAt: Date
}

class WorkspaceManager {
  private baseDir: string  // workspace 根目录，如 .dicecraft/workspaces/

  // 创建新的 workspace
  create(userId?: string): Workspace

  // 获取 workspace
  get(id: string): Workspace | undefined

  // 列出所有 workspace
  list(): Workspace[]

  // 删除 workspace
  delete(id: string): void
}
```

### 路径权限检查

```typescript
// src/workspace/guard.ts
class WorkspaceGuard {
  private workspacePath: string

  constructor(workspacePath: string)

  // 检查路径是否在 workspace 内
  // 如果超出范围，直接抛出错误（不询问用户）
  assertWithinWorkspace(filepath: string): void

  // 解析并验证路径
  resolvePath(filepath: string): string
}
```

**关键逻辑**：
1. 将路径解析为绝对路径
2. 使用 `path.relative()` 检查是否在 workspace 内
3. 如果相对路径以 `..` 开头或超出边界，抛出错误
4. 不询问用户，直接拒绝

### 工具实现

#### read.ts

```typescript
{
  id: "read",
  description: "Read a file or list directory contents",
  parameters: {
    filePath: string      // 绝对路径或相对于 workspace 的路径
    offset?: number       // 起始行号（1-indexed）
    limit?: number        // 最大行数（默认 2000）
  }
}
```

**实现要点**：
- 使用 `WorkspaceGuard.assertWithinWorkspace()` 检查权限
- 支持读取文件和目录（目录返回文件列表）
- 二进制文件检测并拒绝
- 行号前缀格式：`line: content`
- 单行超过 2000 字符截断
- 超过 limit 提示使用 offset 继续读取

#### write.ts

```typescript
{
  id: "write",
  description: "Write content to a file",
  parameters: {
    content: string       // 要写入的内容
    filePath: string      // 文件路径
  }
}
```

**实现要点**：
- 使用 `WorkspaceGuard.assertWithinWorkspace()` 检查权限
- 自动创建父目录（`fs.mkdir` with `recursive: true`）
- 文件已存在时覆盖

#### edit.ts

```typescript
{
  id: "edit",
  description: "Edit a file by replacing oldString with newString",
  parameters: {
    filePath: string        // 文件路径
    oldString: string       // 要替换的文本
    newString: string       // 替换后的文本
    replaceAll?: boolean    // 是否替换所有出现（默认 false）
  }
}
```

**实现要点**：
- 使用 `WorkspaceGuard.assertWithinWorkspace()` 检查权限
- 文件必须存在
- `oldString` 和 `newString` 不能相同
- 替换策略（按优先级）：
  1. 精确匹配
  2. 行级 trim 匹配
  3. 空白规范化匹配
  4. 缩进无关匹配
- 单次替换模式：`oldString` 必须恰好匹配一次
- 多次替换模式：`replaceAll=true` 时替换所有

#### glob.ts

```typescript
{
  id: "glob",
  description: "Find files by glob pattern",
  parameters: {
    pattern: string       // glob 模式（如 "**/*.ts"）
    path?: string         // 搜索目录（默认 workspace 根目录）
  }
}
```

**实现要点**：
- 使用 `WorkspaceGuard.assertWithinWorkspace()` 检查搜索路径
- 使用 `fast-glob` 或 `glob` 库
- 结果按修改时间降序排列
- 最多返回 100 个结果
- 超过 100 时提示使用更精确的模式

#### grep.ts

```typescript
{
  id: "grep",
  description: "Search file contents by regex pattern",
  parameters: {
    pattern: string       // 正则表达式
    path?: string         // 搜索目录或文件（默认 workspace）
    include?: string      // 文件过滤（如 "*.ts"）
  }
}
```

**实现要点**：
- 使用 `WorkspaceGuard.assertWithinWorkspace()` 检查搜索路径
- 使用 `ripgrep`（`rg` 命令）进行搜索
- 结果按文件分组，每组按修改时间排序
- 最多返回 100 个匹配
- 单行超过 2000 字符截断

#### skill.ts

```typescript
{
  id: "list_skills",
  description: "List all available skills (SKILL.md files)",
  parameters: {}
}
```

**实现要点**：
- 在 workspace 内搜索 `**/SKILL.md`
- 解析每个 SKILL.md 的 frontmatter（使用 `gray-matter`）
- 返回 skill 列表，包含：
  - `name`: skill 名称
  - `description`: 描述
  - `path`: 文件路径
- 建议用户使用 Read 工具查看完整内容

## Skill 文件格式

```markdown
---
name: my-skill
description: A useful skill for doing something
---

# My Skill

Skill content here...
```

## 实现步骤

### Phase 1: Workspace 基础设施

**文件**: `src/workspace/manager.ts`
- `Workspace` 接口
- `WorkspaceManager` 类
- 创建、获取、列出、删除 workspace

**文件**: `src/workspace/guard.ts`
- `WorkspaceGuard` 类
- `assertWithinWorkspace()` 方法
- `resolvePath()` 方法

### Phase 2: 文件操作工具

**文件**: `src/tool/read.ts`
- 读取文件内容
- 支持 offset/limit 分页
- 目录列表

**文件**: `src/tool/write.ts`
- 写入文件
- 自动创建父目录

**文件**: `src/tool/edit.ts`
- 编辑文件
- 替换策略实现

### Phase 3: 搜索工具

**文件**: `src/tool/glob.ts`
- Glob 文件搜索
- 结果限制和排序

**文件**: `src/tool/grep.ts`
- 正则内容搜索
- 使用 ripgrep

### Phase 4: Skill 工具

**文件**: `src/tool/skill.ts`
- 搜索 SKILL.md
- 解析 frontmatter
- 返回 skill 列表

### Phase 5: 集成测试

- 注册所有工具到 ToolRegistry
- 测试路径越界拒绝
- 测试文件操作正常工作
- 测试 skill 发现

## 关键设计决策

1. **直接失败，不询问用户**：超出 workspace 范围直接抛出错误，简化权限模型。
2. **独立 workspace**：每个用户/会话独立的 workspace，避免冲突。
3. **工具可复用**：工具本身不绑定特定 agent，可被 subagent 使用。
4. **Skill 发现**：通过 SKILL.md + frontmatter 实现可扩展的 skill 系统。
5. **渐进实现**：先实现基础文件操作，再实现搜索和 skill。

## 验证方式

1. `bun run check` 全部通过
2. 测试 read/write/edit 正常工作
3. 测试路径越界被拒绝
4. 测试 glob/grep 搜索功能
5. 测试 SKILL.md 发现和解析

## 依赖

- `gray-matter`：解析 SKILL.md 的 frontmatter
- `glob` 或 `fast-glob`：文件搜索
- `ripgrep`（系统依赖）：内容搜索

## 参考文件

- `references/opencode/packages/opencode/src/tool/read.ts` - Read 工具实现
- `references/opencode/packages/opencode/src/tool/write.ts` - Write 工具实现
- `references/opencode/packages/opencode/src/tool/edit.ts` - Edit 工具实现
- `references/opencode/packages/opencode/src/tool/glob.ts` - Glob 工具实现
- `references/opencode/packages/opencode/src/tool/grep.ts` - Grep 工具实现
