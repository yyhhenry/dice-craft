import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"

export const WriteTool: Tool = {
  id: "write",
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. " +
    "Parent directories are created automatically.",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "The absolute path to the file to write",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["filePath", "content"],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.filePath as string
    const content = args.content as string

    if (!filePath) {
      return { content: "Error: filePath is required", isError: true }
    }

    const resolved = path.resolve(filePath)
    const dir = path.dirname(resolved)

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(resolved, content)

    const lines = content.split("\n").length
    return { content: `Wrote ${lines} lines to ${resolved}` }
  },
}
