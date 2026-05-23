import type { Tool } from "./base"
import { GetCurrentTimeTool } from "./time"

export function loadBuiltinTools(): Tool[] {
  return [GetCurrentTimeTool]
}
