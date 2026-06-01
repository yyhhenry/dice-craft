import fs from "fs"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

const DEFAULT_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

export function createReadTool(guard: WorkspaceGuard): Tool {
  return {
    id: "read",
    description:
      "Read the contents of a file. Returns the file content with line numbers. " +
      "Supports offset and limit for reading large files. " +
      "Can also list directory contents when given a directory path. " +
      "Paths are resolved relative to the workspace directory.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "The path to the file or directory to read (relative to workspace, or absolute within workspace)",
        },
        offset: {
          type: "number",
          description: "The line number to start reading from (1-indexed). Defaults to 1.",
        },
        limit: {
          type: "number",
          description: "The maximum number of lines to read. Defaults to 2000.",
        },
      },
      required: ["filePath"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const filePath = args.filePath as string
      const offset = (args.offset as number) || 1
      const limit = (args.limit as number) || DEFAULT_LIMIT

      if (!filePath) {
        return { content: "Error: filePath is required", isError: true }
      }

      guard.assertWithinWorkspace(filePath)
      const resolved = guard.resolvePath(filePath)

      if (!fs.existsSync(resolved)) {
        return { content: `Error: File not found: ${filePath}`, isError: true }
      }

      const stat = fs.statSync(resolved)

      if (stat.isDirectory()) {
        const entries = fs.readdirSync(resolved).sort()
        const start = offset - 1
        const sliced = entries.slice(start, start + limit)
        const truncated = start + sliced.length < entries.length

        const output = [
          `<path>${filePath}</path>`,
          `<type>directory</type>`,
          `<entries>`,
          sliced.join("\n"),
          truncated
            ? `\n(Showing ${sliced.length} of ${entries.length} entries. Use offset to read beyond.)`
            : `\n(${entries.length} entries)`,
          `</entries>`,
        ].join("\n")

        return { content: output }
      }

      const content = fs.readFileSync(resolved, "utf-8")
      const lines = content.split("\n")
      const start = offset - 1
      const sliced = lines.slice(start, start + limit)
      const truncated = start + sliced.length < lines.length

      const numberedLines = sliced.map((line, i) => {
        const truncatedLine = line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
        return `${i + offset}: ${truncatedLine}`
      })

      const last = offset + sliced.length - 1
      const output = [
        `<path>${filePath}</path>`,
        `<type>file</type>`,
        `<content>`,
        numberedLines.join("\n"),
        truncated
          ? `\n(Showing lines ${offset}-${last} of ${lines.length}. Use offset=${last + 1} to continue.)`
          : `\n(End of file - total ${lines.length} lines)`,
        `</content>`,
      ].join("\n")

      return { content: output }
    },
  }
}
