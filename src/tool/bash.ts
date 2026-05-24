import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

const DEFAULT_TIMEOUT = 30_000
const MAX_TIMEOUT = 120_000
const MAX_OUTPUT = 50_000
const MAX_LINES = 2000
const OUTPUT_DIR = ".tool-output"

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
      const timeout = Math.min(
        (args.timeout as number) || DEFAULT_TIMEOUT,
        MAX_TIMEOUT,
      )

      if (!command) {
        return { content: "Error: command is required", isError: true }
      }

      const proc = Bun.spawn(["bash", "-c", command], {
        cwd: guard.getWorkspacePath(),
        stdout: "pipe",
        stderr: "pipe",
      })

      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill("SIGTERM")
      }, timeout)

      try {
        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        await proc.exited
        clearTimeout(timer)

        if (timedOut) {
          return {
            content: `Error: command timed out after ${timeout}ms`,
            isError: true,
          }
        }

        const exitCode = proc.exitCode ?? -1
        let fullOutput = ""
        if (stdout) fullOutput += stdout
        if (stderr) fullOutput += (fullOutput ? "\n" : "") + stderr

        const lines = fullOutput.split("\n")
        const needsTruncate =
          fullOutput.length > MAX_OUTPUT || lines.length > MAX_LINES

        if (needsTruncate) {
          const outputPath = saveOutput(guard.getWorkspacePath(), fullOutput)
          const tail = tailOutput(lines)
          const content = [
            "...output truncated...",
            `Full output saved to: ${outputPath}`,
            "",
            tail,
            exitCode !== 0 ? `\n(exit code: ${exitCode})` : "",
          ]
            .join("\n")
            .trimEnd()
          return { content, isError: exitCode !== 0 }
        }

        let output = fullOutput
        if (exitCode !== 0) output += `\n(exit code: ${exitCode})`
        return { content: output || "(no output)", isError: exitCode !== 0 }
      } catch (e) {
        clearTimeout(timer)
        proc.kill("SIGKILL")
        return {
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
          isError: true,
        }
      }
    },
  }
}

function saveOutput(workspacePath: string, content: string): string {
  const dir = path.join(workspacePath, OUTPUT_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `bash_${Date.now()}.txt`)
  fs.writeFileSync(filePath, content, "utf-8")
  return filePath
}

function tailOutput(lines: string[]): string {
  const tail = lines.slice(-MAX_LINES)
  let result = tail.join("\n")
  if (result.length > MAX_OUTPUT) {
    result = result.slice(result.length - MAX_OUTPUT)
    const nl = result.indexOf("\n")
    if (nl !== -1) result = result.slice(nl + 1)
  }
  return result
}
