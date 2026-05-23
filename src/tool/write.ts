import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

export function createWriteTool(guard: WorkspaceGuard): Tool {
  return {
    id: "write",
    description:
      "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. " +
      "Parent directories are created automatically. " +
      "Paths are resolved relative to the workspace directory.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The path to the file to write (relative to workspace, or absolute within workspace)",
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

      guard.assertWithinWorkspace(filePath)
      const resolved = guard.resolvePath(filePath)

      const dir = path.dirname(resolved)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(resolved, content)

      const lines = content.split("\n").length
      return { content: `Wrote ${lines} lines to ${filePath}` }
    },
  }
}
