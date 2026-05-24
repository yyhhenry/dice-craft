import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import os from "os"
import { createBashTool } from "../../src/tool/bash"
import { WorkspaceGuard } from "../../src/workspace/guard"

describe("createBashTool", () => {
  let tmpDir: string
  let guard: WorkspaceGuard
  let tool: ReturnType<typeof createBashTool>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bash-test-"))
    guard = new WorkspaceGuard(tmpDir)
    tool = createBashTool(guard)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("tool definition contains required fields", () => {
    expect(tool.id).toBe("bash")
    expect(tool.description).toBeTruthy()
    expect(tool.parameters.properties?.command).toBeTruthy()
  })

  test("executes simple command and returns stdout", async () => {
    const result = await tool.execute({ command: "echo hello" })
    expect(result.content).toContain("hello")
    expect(result.isError).toBeFalsy()
  })

  test("captures stderr", async () => {
    const result = await tool.execute({ command: 'bash -c "echo err >&2"' })
    expect(result.content).toContain("err")
  })

  test("reports non-zero exit code as error", async () => {
    const result = await tool.execute({ command: "false" })
    expect(result.isError).toBe(true)
    expect(result.content).toContain("exit code: 1")
  })

  test("reports exit code for custom failures", async () => {
    const result = await tool.execute({ command: "exit 42" })
    expect(result.isError).toBe(true)
    expect(result.content).toContain("exit code: 42")
  })

  test("returns (no output) for silent commands", async () => {
    const result = await tool.execute({ command: "true" })
    expect(result.content).toBe("(no output)")
  })

  test("sets cwd to workspace path", async () => {
    const result = await tool.execute({ command: "pwd" })
    expect(result.content.trim()).toBe(tmpDir)
  })

  test("times out on long-running command", async () => {
    const result = await tool.execute({ command: "sleep 100", timeout: 500 })
    expect(result.isError).toBe(true)
    expect(result.content).toContain("timed out")
  })

  test("respects custom timeout", async () => {
    const result = await tool.execute({ command: "echo ok", timeout: 5000 })
    expect(result.content).toContain("ok")
    expect(result.isError).toBeFalsy()
  })

  test("clamps timeout to max 120s", async () => {
    // just verify it doesn't error when passing a large timeout
    const result = await tool.execute({ command: "echo ok", timeout: 999999 })
    expect(result.content).toContain("ok")
  })

  test("returns error for empty command", async () => {
    const result = await tool.execute({ command: "" })
    expect(result.isError).toBe(true)
    expect(result.content).toContain("command is required")
  })

  test("python -c works", async () => {
    const result = await tool.execute({ command: 'python3 -c "print(1+2)"' })
    expect(result.content.trim()).toBe("3")
  })

  test("truncates large output and saves to file", async () => {
    // generate ~200KB of output
    const result = await tool.execute({
      command: "seq 1 100000",
    })
    expect(result.content).toContain("output truncated")
    expect(result.content).toContain("Full output saved to:")

    // extract file path and verify it exists with full content
    const match = result.content.match(/Full output saved to: (.+)/)
    expect(match).not.toBeNull()
    const filePath = match![1]!
    expect(fs.existsSync(filePath)).toBe(true)
    const saved = fs.readFileSync(filePath, "utf-8")
    expect(saved.split("\n").length).toBe(100001) // seq produces N lines
  })
})
