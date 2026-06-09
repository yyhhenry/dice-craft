import { describe, test, expect, afterEach } from "bun:test"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(import.meta.dir, "../..")
const ROLL = path.join(ROOT, "templates/skills/dnd/runtime/scripts/roll.py")
const STATE = path.join(ROOT, "templates/skills/dnd/runtime/scripts/state.py")
const WORK_DIR = path.join("/tmp", `dnd-state-${Date.now()}`)

afterEach(() => {
  if (fs.existsSync(WORK_DIR)) {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
  }
})

describe("dnd runtime scripts", () => {
  test("roll.py check outputs JSON", async () => {
    const proc = Bun.spawn(["python", ROLL, "check", "--mod", "3", "--dc", "13", "--reason", "Test"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    })
    const out = await new Response(proc.stdout).text()
    const code = await proc.exited
    expect(code).toBe(0)
    const json = JSON.parse(out.trim())
    expect(json.kind).toBe("check")
    expect(json.dc).toBe(13)
    expect(typeof json.total).toBe("number")
  })

  test("state.py init and get/set", async () => {
    fs.mkdirSync(path.join(WORK_DIR, "skills/dnd/instances/test_adv"), { recursive: true })
    fs.writeFileSync(path.join(WORK_DIR, "skills/dnd/instances/test_adv/meta.json"), "{}")

    const init = Bun.spawn(["python", STATE, "init", "--instance", "test_adv"], {
      cwd: WORK_DIR,
      stdout: "pipe",
    })
    expect(await init.exited).toBe(0)

    const set = Bun.spawn(
      ["python", STATE, "set", "--instance", "test_adv", "--path", "party.0.hp", "--json", "10"],
      { cwd: WORK_DIR, stdout: "pipe" },
    )
    const setOut = await new Response(set.stdout).text()
    expect(await set.exited).toBe(0)
    expect(JSON.parse(setOut.trim()).ok).toBe(true)

    const get = Bun.spawn(
      ["python", STATE, "get", "--instance", "test_adv", "--path", "party.0.hp"],
      { cwd: WORK_DIR, stdout: "pipe" },
    )
    const getOut = await new Response(get.stdout).text()
    expect(await get.exited).toBe(0)
    expect(JSON.parse(getOut.trim()).value).toBe(10)
  })
})
