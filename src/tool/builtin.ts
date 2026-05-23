import type { Tool } from "./base"
import { GetCurrentTimeTool } from "./time"
import { ReadTool } from "./read"
import { WriteTool } from "./write"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"

export function loadBuiltinTools(): Tool[] {
  return [GetCurrentTimeTool, ReadTool, WriteTool, EditTool, GlobTool, GrepTool]
}
