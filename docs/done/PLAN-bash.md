# Bash Tool 设计计划

## 目标

为 Agent 提供 `bash` 工具，使其能够执行 shell 命令。Python 能力通过 `python -c` 自然获得，不需要单独的 python tool。

## 设计思路

- 工具名为 `bash`，接收一个 `command` 字符串参数
- 命令在 workspace 目录下执行（`cwd` 设为 workspace path）
- 不做严格的沙箱拦截（大作业级别，够用即可）
- 通过 prompt 引导模型在 workspace 内操作
- 捕获 stdout + stderr，设置超时防止卡死
- 大输出截断后保存到文件，Agent 可用 grep/read 分段查看

## 工具定义

```typescript
// src/tool/bash.ts
import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

const DEFAULT_TIMEOUT = 30_000   // 30 秒
const MAX_OUTPUT = 50_000        // 返回给模型的最大输出：50KB
const MAX_LINES = 2000           // 返回给模型的最大行数
const OUTPUT_DIR = "data/tool-output"  // 大输出保存目录（相对于项目根）

export function createBashTool(guard: WorkspaceGuard): Tool {
  return {
    id: "bash",
    description:
      "Execute a shell command in the workspace directory. " +
      "Use this to run build commands, tests, scripts, or python one-liners (python -c '...'). " +
      "Commands run with cwd set to the workspace root. " +
      "If output is large, it will be saved to a file and you'll get the tail + file path. " +
      "Use grep or read on that file to examine specific parts.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 30000, max 120000)",
        },
      },
      required: ["command"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const command = args.command as string
      const timeout = Math.min((args.timeout as number) || DEFAULT_TIMEOUT, 120_000)

      if (!command) {
        return { content: "Error: command is required", isError: true }
      }

      const proc = Bun.spawn(["bash", "-c", command], {
        cwd: guard.getWorkspacePath(),
        stdout: "pipe",
        stderr: "pipe",
      })

      const timer = setTimeout(() => proc.kill("SIGTERM"), timeout)

      try {
        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        await proc.exited
        clearTimeout(timer)

        const exitCode = proc.exitCode ?? -1
        let fullOutput = ""
        if (stdout) fullOutput += stdout
        if (stderr) fullOutput += (fullOutput ? "\n" : "") + stderr

        // 判断是否需要截断
        const lines = fullOutput.split("\n")
        const needsTruncate = fullOutput.length > MAX_OUTPUT || lines.length > MAX_LINES

        if (needsTruncate) {
          // 保存完整输出到文件
          const outputPath = saveOutput(fullOutput)
          // 返回尾部预览
          const tail = tailOutput(lines)
          const content = [
            "...output truncated...",
            `Full output saved to: ${outputPath}`,
            "",
            tail,
            exitCode !== 0 ? `\n(exit code: ${exitCode})` : "",
          ].join("\n")
          return { content, isError: exitCode !== 0 }
        }

        let output = fullOutput
        if (exitCode !== 0) output += `\n(exit code: ${exitCode})`
        return { content: output || "(no output)", isError: exitCode !== 0 }
      } catch (e) {
        clearTimeout(timer)
        proc.kill("SIGKILL")
        return {
          content: `Error: command timed out after ${timeout}ms`,
          isError: true,
        }
      }
    },
  }
}

/** 保存完整输出到 data/tool-output/，返回文件路径 */
function saveOutput(content: string): string {
  const dir = path.resolve(OUTPUT_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const ts = Date.now()
  const filePath = path.join(dir, `bash_${ts}.txt`)
  fs.writeFileSync(filePath, content, "utf-8")
  return filePath
}

/** 截取尾部，控制在 MAX_OUTPUT / MAX_LINES 以内 */
function tailOutput(lines: string[]): string {
  const tail = lines.slice(-MAX_LINES)
  let result = tail.join("\n")
  if (result.length > MAX_OUTPUT) {
    result = result.slice(result.length - MAX_OUTPUT)
    // 跳过被截断的首行（可能不完整）
    const nl = result.indexOf("\n")
    if (nl !== -1) result = result.slice(nl + 1)
  }
  return result
}
```

## 关键实现细节

### 1. 执行环境

- `cwd` 设为 `guard.getWorkspacePath()`，引导模型在 workspace 内操作
- 不设置额外的环境变量限制（不拦截 `cd`、绝对路径等）
- 子进程继承当前进程的环境变量

### 2. 超时处理

- 默认 30 秒，允许模型传入自定义 timeout（最大 120 秒）
- 超时后发送 `SIGTERM`，若进程不退出则 `SIGKILL`
- 超时也算执行失败（`isError: true`）

### 3. 输出捕获与截断

- 同时捕获 stdout 和 stderr，合并返回
- 非零 exit code 标记为 `isError: true`，附带 exit code
- 输出超过 50KB 或 2000 行时触发截断：
  - 完整输出保存到 `data/tool-output/bash_<timestamp>.txt`
  - 返回尾部预览（最后 2000 行，不超过 50KB）+ 文件路径
  - Agent 可用 `read` 分段查看，或用 `grep` 搜索关键内容

### 4. 安全考量（大作业级别）

**不做**（超出范围）：
- 命令白名单/黑名单
- 文件系统拦截（不检查 bash 内部的 `cat`、`rm` 等）
- 网络访问限制
- 进程隔离 / namespace

**做**：
- 超时机制，防止死循环
- 输出截断，防止撑爆上下文
- prompt 中引导模型在 workspace 内工作

## 注册

在 `src/tool/builtin.ts` 中添加：

```typescript
import { createBashTool } from "./bash"

export function loadBuiltinTools(guard: WorkspaceGuard): Tool[] {
  return [
    createTimeTool(),
    createReadTool(guard),
    createWriteTool(guard),
    createEditTool(guard),
    createGlobTool(guard),
    createGrepTool(guard),
    createBashTool(guard),    // 新增
  ]
}
```

在 `src/tool/index.ts` 中导出。

### 清理与 gitignore

- `data/tool-output/` 目录已在 `.gitignore` 中（属于 `data/` 下）
- 可选：启动时清理超过 7 天的旧文件（大作业阶段非必须，手动清理即可）

## 测试计划

### 基本功能
- 执行简单命令（`echo hello`），验证 stdout 输出
- 执行失败命令（`false`），验证 exit code 和 `isError`
- 执行产生 stderr 的命令（`bash -c "echo err >&2"`），验证 stderr 被捕获

### Python 能力
- `python -c "print(1+2)"` 返回 `3`
- `python -c "import sys; print(sys.version)"` 返回版本信息

### 超时
- `sleep 100` 配合短 timeout，验证超时返回错误

### 输出截断
- `seq 1 1000000` 产生大输出，验证：
  - 返回内容包含 "output truncated" 和文件路径
  - 返回内容是尾部预览，不是头部
  - 文件保存在 `data/tool-output/bash_*.txt`，内容完整
  - Agent 可用 grep/read 工具查看该文件

### 工作目录
- `pwd` 返回 workspace path
- `ls` 列出 workspace 内容

## 验证方式

1. `bun run check` 全部通过
2. CLI 中 Agent 能调用 bash 执行命令
3. `python -c` 可正常运行 Python 代码
4. 超时命令正确返回错误
5. 大输出被截断，完整内容保存到文件，Agent 可 grep/read 分段查看
