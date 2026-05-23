import path from "path"
import { spawn } from "child_process"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

const MAX_RESULTS = 100
const MAX_LINE_LENGTH = 2000

export function createGrepTool(guard: WorkspaceGuard): Tool {
  return {
    id: "grep",
    description:
      "Search file contents using a regex pattern. Uses ripgrep for fast searching. " +
      "Returns matching lines with file paths and line numbers. " +
      "Paths are resolved relative to the workspace directory.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The regex pattern to search for in file contents",
        },
        path: {
          type: "string",
          description: "The directory to search in. Defaults to the workspace root.",
        },
        include: {
          type: "string",
          description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
        },
      },
      required: ["pattern"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const pattern = args.pattern as string
      const searchPath = (args.path as string) || "."
      const include = args.include as string | undefined

      if (!pattern) {
        return { content: "Error: pattern is required", isError: true }
      }

      guard.assertWithinWorkspace(searchPath)
      const resolved = guard.resolvePath(searchPath)

      // Build ripgrep command
      const rgArgs = [
        "--no-heading",
        "--line-number",
        "--max-count", "1",
        "--max-filesize", "1M",
        "--color", "never",
      ]

      if (include) {
        rgArgs.push("--glob", include)
      }

      rgArgs.push("--", pattern, resolved)

      try {
        const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
          const proc = spawn("rg", rgArgs, { stdio: ["pipe", "pipe", "pipe"] })
          let stdout = ""
          let stderr = ""

          proc.stdout.on("data", (data: Buffer) => {
            stdout += data.toString()
          })
          proc.stderr.on("data", (data: Buffer) => {
            stderr += data.toString()
          })
          proc.on("close", (code: number) => {
            resolve({ stdout, stderr, code })
          })
          proc.on("error", (err) => {
            reject(err)
          })
        })

        if (result.code !== 0 && !result.stdout) {
          return { content: "No matches found" }
        }

        const lines = result.stdout.split("\n").filter((l) => l.trim())
        const matches: Array<{ file: string; line: number; text: string }> = []

        for (const line of lines) {
          if (matches.length >= MAX_RESULTS) break
          // Format: file:line:text
          const firstColon = line.indexOf(":")
          const secondColon = line.indexOf(":", firstColon + 1)
          if (firstColon === -1 || secondColon === -1) continue

          const file = line.substring(0, firstColon)
          const lineNum = parseInt(line.substring(firstColon + 1, secondColon), 10)
          const text = line.substring(secondColon + 1)

          matches.push({ file, line: lineNum, text })
        }

        if (matches.length === 0) {
          return { content: "No matches found" }
        }

        const truncated = lines.length > MAX_RESULTS
        const output = [`Found ${matches.length} matches${truncated ? ` (showing first ${MAX_RESULTS})` : ""}`]

        let currentFile = ""
        for (const match of matches) {
          if (currentFile !== match.file) {
            if (currentFile !== "") output.push("")
            currentFile = match.file
            output.push(`${path.relative(guard.resolvePath("."), match.file)}:`)
          }
          const text =
            match.text.length > MAX_LINE_LENGTH
              ? match.text.substring(0, MAX_LINE_LENGTH) + "..."
              : match.text
          output.push(`  Line ${match.line}: ${text}`)
        }

        if (truncated) {
          output.push("")
          output.push(
            `(Results truncated: showing ${MAX_RESULTS} of ${lines.length} matches. Consider using a more specific path or pattern.)`
          )
        }

        return { content: output.join("\n") }
      } catch {
        return {
          content: "Error: ripgrep (rg) not found. Please install ripgrep to use the grep tool.",
          isError: true,
        }
      }
    },
  }
}
