import { describe, test, expect } from "bun:test"
import { parseUserCommand, slugifyTheme } from "../../src/game/commands"

describe("parseUserCommand", () => {
  test("recognizes /play with slug", () => {
    expect(parseUserCommand("/play ring_adventure")).toEqual({
      kind: "play",
      slug: "ring_adventure",
      content: "/play ring_adventure",
    })
  })

  test("recognizes /build", () => {
    expect(parseUserCommand("/build").kind).toBe("build")
  })

  test("treats normal text as message", () => {
    expect(parseUserCommand("我想玩指环王式DND").kind).toBe("message")
  })
})

describe("slugifyTheme", () => {
  test("normalizes theme", () => {
    expect(slugifyTheme("Ring Adventure!")).toBe("ring_adventure")
  })
})
