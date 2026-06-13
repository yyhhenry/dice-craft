import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import os from "os"
import { createReadTool } from "../../src/tool/read"
import { WorkspaceGuard } from "../../src/workspace/guard"

describe("createReadTool", () => {
  let tmpDir: string
  let guard: WorkspaceGuard
  let tool: ReturnType<typeof createReadTool>

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "read-test-")))
    guard = new WorkspaceGuard(tmpDir)
    tool = createReadTool(guard)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("reads a text file with line numbers", async () => {
    fs.writeFileSync(path.join(tmpDir, "hello.txt"), "line1\nline2\nline3\n")
    const result = await tool.execute({ filePath: "hello.txt" })
    expect(result.content).toContain("1: line1")
    expect(result.content).toContain("2: line2")
    expect(result.content).toContain("3: line3")
    expect(result.isError).toBeUndefined()
  })

  test("reads directory listing", async () => {
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "")
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "")
    const result = await tool.execute({ filePath: "." })
    expect(result.content).toContain("a.txt")
    expect(result.content).toContain("b.txt")
    expect(result.content).toContain("<type>directory</type>")
  })

  test("returns error for missing file", async () => {
    const result = await tool.execute({ filePath: "nope.txt" })
    expect(result.isError).toBe(true)
    expect(result.content).toContain("not found")
  })

  test("blocks binary files and returns type + size", async () => {
    const buf = Buffer.alloc(1024, 0xff)
    fs.writeFileSync(path.join(tmpDir, "image.png"), buf)
    const result = await tool.execute({ filePath: "image.png" })
    expect(result.content).toContain("Binary file: image.png")
    expect(result.content).toContain("Type: PNG")
    expect(result.content).toContain("Size: 1.0 KB")
    expect(result.isError).toBeUndefined()
  })

  test("returns WAV metadata for .wav files", async () => {
    // Minimal valid WAV header: 44 bytes + some data
    const header = Buffer.alloc(44 + 88200) // 1 second at 44100 Hz, 16-bit mono
    header.write("RIFF", 0)
    header.writeUInt32LE(44 + 88200 - 8, 4) // file size - 8
    header.write("WAVE", 8)
    header.write("fmt ", 12)
    header.writeUInt32LE(16, 16) // fmt chunk size
    header.writeUInt16LE(1, 20) // PCM
    header.writeUInt16LE(1, 22) // channels = 1
    header.writeUInt32LE(44100, 24) // sample rate
    header.writeUInt32LE(88200, 28) // byte rate (44100 * 1 * 2)
    header.writeUInt16LE(2, 32) // block align
    header.writeUInt16LE(16, 34) // bits per sample
    header.write("data", 36)
    header.writeUInt32LE(88200, 40) // data chunk size

    fs.writeFileSync(path.join(tmpDir, "test.wav"), header)
    const result = await tool.execute({ filePath: "test.wav" })
    expect(result.content).toContain("Audio file: test.wav")
    expect(result.content).toContain("Format: WAV")
    expect(result.content).toContain("Sample rate: 44100 Hz")
    expect(result.content).toContain("Channels: 1")
    expect(result.content).toContain("Bit depth: 16")
    expect(result.content).toContain("Duration: 1.0s")
    expect(result.isError).toBeUndefined()
  })

  test("returns WAV metadata for stereo file", async () => {
    const header = Buffer.alloc(44 + 176400) // 1s at 44100 Hz, 16-bit stereo
    header.write("RIFF", 0)
    header.writeUInt32LE(44 + 176400 - 8, 4)
    header.write("WAVE", 8)
    header.write("fmt ", 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20) // PCM
    header.writeUInt16LE(2, 22) // channels = 2
    header.writeUInt32LE(44100, 24) // sample rate
    header.writeUInt32LE(176400, 28) // byte rate (44100 * 2 * 2)
    header.writeUInt16LE(4, 32) // block align
    header.writeUInt16LE(16, 34) // bits per sample
    header.write("data", 36)
    header.writeUInt32LE(176400, 40)

    fs.writeFileSync(path.join(tmpDir, "stereo.wav"), header)
    const result = await tool.execute({ filePath: "stereo.wav" })
    expect(result.content).toContain("Channels: 2")
    expect(result.content).toContain("Duration: 1.0s")
  })

  test("supports offset and limit for text files", async () => {
    fs.writeFileSync(path.join(tmpDir, "lines.txt"), "a\nb\nc\nd\ne\n")
    const result = await tool.execute({ filePath: "lines.txt", offset: 2, limit: 2 })
    expect(result.content).toContain("2: b")
    expect(result.content).toContain("3: c")
    expect(result.content).not.toContain("1: a")
    expect(result.content).not.toContain("4: d")
  })
})
