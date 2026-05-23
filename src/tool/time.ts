import type { Tool, ToolResult } from "./base"

export const GetCurrentTimeTool: Tool = {
  id: "get_current_time",
  description: "Get current time, supports specifying timezone offset (hours from UTC)",
  parameters: {
    type: "object",
    properties: {
      timezone_offset: {
        type: "number",
        description: "Timezone offset from UTC in hours. e.g. 8 for UTC+8, -5 for UTC-5. Defaults to 8 (Beijing time)",
      },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const offset = (args.timezone_offset as number) ?? 8
      const now = new Date()
      const utc = now.getTime() + now.getTimezoneOffset() * 60000
      const local = new Date(utc + offset * 3600000)

      const year = local.getFullYear()
      const month = String(local.getMonth() + 1).padStart(2, "0")
      const day = String(local.getDate()).padStart(2, "0")
      const hours = String(local.getHours()).padStart(2, "0")
      const minutes = String(local.getMinutes()).padStart(2, "0")
      const seconds = String(local.getSeconds()).padStart(2, "0")

      const timezoneName = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`

      return {
        content: `Current time: ${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${timezoneName})`,
      }
    } catch (error) {
      return {
        content: `Failed to get time: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }
    }
  },
}
