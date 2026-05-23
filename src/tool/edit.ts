import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"

export function createEditTool(guard: WorkspaceGuard): Tool {
  return {
    id: "edit",
    description:
      "Edit a file by replacing oldString with newString. " +
      "The oldString must match exactly (including whitespace and indentation). " +
      "Use replaceAll=true to replace all occurrences. " +
      "Paths are resolved relative to the workspace directory.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The path to the file to modify (relative to workspace, or absolute within workspace)",
        },
        oldString: {
          type: "string",
          description: "The text to replace",
        },
        newString: {
          type: "string",
          description: "The text to replace it with (must be different from oldString)",
        },
        replaceAll: {
          type: "boolean",
          description: "Replace all occurrences of oldString (default false)",
        },
      },
      required: ["filePath", "oldString", "newString"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const filePath = args.filePath as string
      const oldString = args.oldString as string
      const newString = args.newString as string
      const replaceAll = (args.replaceAll as boolean) ?? false

      if (!filePath) {
        return { content: "Error: filePath is required", isError: true }
      }

      if (oldString === newString) {
        return { content: "Error: oldString and newString are identical", isError: true }
      }

      guard.assertWithinWorkspace(filePath)
      const resolved = guard.resolvePath(filePath)

      if (!fs.existsSync(resolved)) {
        // If oldString is empty, create a new file
        if (oldString === "") {
          const dir = path.dirname(resolved)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(resolved, newString)
          return { content: `Created file ${filePath}` }
        }
        return { content: `Error: File not found: ${filePath}`, isError: true }
      }

      const content = fs.readFileSync(resolved, "utf-8")

      if (!content.includes(oldString)) {
        return {
          content: "Error: Could not find oldString in the file. It must match exactly, including whitespace and indentation.",
          isError: true,
        }
      }

      let newContent: string
      if (replaceAll) {
        newContent = content.replaceAll(oldString, newString)
      } else {
        // Check for multiple occurrences
        const firstIndex = content.indexOf(oldString)
        const lastIndex = content.lastIndexOf(oldString)
        if (firstIndex !== lastIndex) {
          return {
            content: "Error: Found multiple matches for oldString. Provide more surrounding context to make the match unique, or use replaceAll=true.",
            isError: true,
          }
        }
        newContent = content.substring(0, firstIndex) + newString + content.substring(firstIndex + oldString.length)
      }

      fs.writeFileSync(resolved, newContent)

      const oldLines = oldString.split("\n").length
      const newLines = newString.split("\n").length
      return {
        content: `Edit applied successfully. Replaced ${oldLines}-line block with ${newLines}-line block in ${filePath}`,
      }
    },
  }
}
