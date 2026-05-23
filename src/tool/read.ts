import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"

const DEFAULT_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

export const ReadTool: Tool = {
  id: "read",
  description:
    "Read the contents of a file. Returns the file content with line numbers. " +
    "Supports offset and limit for reading large files. " +
    "Can also list directory contents when given a directory path.",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "The absolute path to the file or directory to read",
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

    const resolved = path.resolve(filePath)

    if (!fs.existsSync(resolved)) {
      return { content: `Error: File not found: ${resolved}`, isError: true }
    }

    const stat = fs.statSync(resolved)

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolved).sort()
      const start = offset - 1
      const sliced = entries.slice(start, start + limit)
      const truncated = start + sliced.length < entries.length

      const output = [
        `<path>${resolved}</path>`,
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
      const truncatedLine =
        line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
      return `${i + offset}: ${truncatedLine}`
    })

    const last = offset + sliced.length - 1
    const output = [
      `<path>${resolved}</path>`,
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
