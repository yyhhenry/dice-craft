import path from "path"
import { Glob } from "bun"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

const MAX_RESULTS = 100

export function createGlobTool(guard: WorkspaceGuard): Tool {
  return {
    id: "glob",
    description:
      "Find files matching a glob pattern. Returns matching file paths sorted by modification time. " +
      "Useful for finding files by name or extension. " +
      "Paths are resolved relative to the workspace directory.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.test.ts')",
        },
        path: {
          type: "string",
          description: "The directory to search in. Defaults to the workspace root.",
        },
      },
      required: ["pattern"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const pattern = args.pattern as string
      const searchPath = (args.path as string) || "."

      if (!pattern) {
        return { content: "Error: pattern is required", isError: true }
      }

      guard.assertWithinWorkspace(searchPath)
      const resolved = guard.resolvePath(searchPath)

      const glob = new Glob(pattern)

      const files: string[] = []
      let count = 0

      for await (const match of glob.scan({ cwd: resolved, absolute: true })) {
        count++
        if (count > MAX_RESULTS) continue
        files.push(match)
      }

      const truncated = count > MAX_RESULTS

      if (files.length === 0) {
        return { content: "No files found" }
      }

      const output = files.map((f) => path.relative(guard.resolvePath("."), f))
      if (truncated) {
        output.push("")
        output.push(`(Results are truncated: showing first ${MAX_RESULTS} results. Consider using a more specific path or pattern.)`)
      }

      return { content: output.join("\n") }
    },
  }
}
