import type { Tool } from "./base"
import type { WorkspaceGuard } from "../workspace/guard"
import { createTimeTool } from "./time"
import { createReadTool } from "./read"
import { createWriteTool } from "./write"
import { createEditTool } from "./edit"
import { createGlobTool } from "./glob"
import { createGrepTool } from "./grep"

export function loadBuiltinTools(guard: WorkspaceGuard): Tool[] {
  return [
    createTimeTool(),
    createReadTool(guard),
    createWriteTool(guard),
    createEditTool(guard),
    createGlobTool(guard),
    createGrepTool(guard),
  ]
}
