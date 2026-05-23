import path from "path"
import { Glob } from "bun"
import type { Tool, ToolResult } from "./base"

const MAX_RESULTS = 100

export const GlobTool: Tool = {
  id: "glob",
  description:
    "Find files matching a glob pattern. Returns matching file paths sorted by modification time. " +
    "Useful for finding files by name or extension.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "The glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.test.ts')",
      },
      path: {
        type: "string",
        description: "The directory to search in. Defaults to the current working directory.",
      },
    },
    required: ["pattern"],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = args.pattern as string
    const searchPath = (args.path as string) || process.cwd()

    if (!pattern) {
      return { content: "Error: pattern is required", isError: true }
    }

    const resolved = path.resolve(searchPath)
    const glob = new Glob(pattern)

    const files: Array<{ path: string; mtime: number }> = []
    let count = 0

    for await (const match of glob.scan({ cwd: resolved, absolute: true })) {
      count++
      if (count > MAX_RESULTS) continue
      files.push({ path: match, mtime: 0 })
    }

    const truncated = count > MAX_RESULTS
    const sorted = files.slice(0, MAX_RESULTS)

    if (sorted.length === 0) {
      return { content: "No files found" }
    }

    const output = sorted.map((f) => f.path)
    if (truncated) {
      output.push("")
      output.push(`(Results are truncated: showing first ${MAX_RESULTS} results. Consider using a more specific path or pattern.)`)
    }

    return { content: output.join("\n") }
  },
}
