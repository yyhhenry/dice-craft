import { describe, test, expect, afterEach } from "bun:test"
import fs from "fs"
import path from "path"
import { instanceExists, instanceRelPath } from "../../src/game/instance"

const TEST_DIR = path.join("/tmp", "dicecraft-instance-test-" + Date.now())

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

describe("instance helpers", () => {
  test("instanceRelPath", () => {
    expect(instanceRelPath("dnd", "ring_adventure")).toBe("skills/dnd/instances/ring_adventure")
  })

  test("instanceExists checks meta or adventure", () => {
    const base = path.join(TEST_DIR, "skills", "dnd", "instances", "test_adv")
    fs.mkdirSync(base, { recursive: true })
    fs.writeFileSync(path.join(base, "adventure.json"), "{}")

    expect(instanceExists(TEST_DIR, "dnd", "test_adv")).toBe(true)
    expect(instanceExists(TEST_DIR, "dnd", "missing")).toBe(false)
  })
})
