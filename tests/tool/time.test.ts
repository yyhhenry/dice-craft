import { describe, test, expect } from "bun:test"
import { GetCurrentTimeTool } from "../../src/tool/time"

describe("GetCurrentTimeTool", () => {
  test("returns correctly formatted time string", async () => {
    const result = await GetCurrentTimeTool.execute({})
    expect(result.content).toMatch(/^Current time: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(UTC[+-]\d+\)$/)
    expect(result.isError).toBeUndefined()
  })

  test("defaults to UTC+8 (Beijing time)", async () => {
    const result = await GetCurrentTimeTool.execute({})
    expect(result.content).toContain("UTC+8")
  })

  test("supports custom timezone offset", async () => {
    const result = await GetCurrentTimeTool.execute({ timezone_offset: -5 })
    expect(result.content).toContain("UTC-5")
  })

  test("zero timezone offset displays correctly", async () => {
    const result = await GetCurrentTimeTool.execute({ timezone_offset: 0 })
    expect(result.content).toContain("UTC+0")
  })

  test("tool definition contains required fields", () => {
    expect(GetCurrentTimeTool.id).toBe("get_current_time")
    expect(GetCurrentTimeTool.description).toBeTruthy()
    expect(GetCurrentTimeTool.parameters.type).toBe("object")
    expect(GetCurrentTimeTool.parameters.properties?.timezone_offset).toBeTruthy()
  })
})
