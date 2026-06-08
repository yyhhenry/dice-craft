import { describe, test, expect } from "bun:test"
import { loadAgents } from "../../src/agent/registry"
import { buildPrimarySystemPrompt } from "../../src/agent/prompt"

describe("buildPrimarySystemPrompt", () => {
  const registry = loadAgents()

  test("uses builder in build mode", () => {
    const prompt = buildPrimarySystemPrompt({
      agentRegistry: registry,
      gameMode: "build",
      skillsSection: "## Skills",
    })
    expect(prompt).toContain("Builder")
    expect(prompt).not.toContain("Active Game Instance")
    expect(prompt).toContain("same language as the player")
    expect(prompt).not.toContain("dnd-runtime")
  })

  test("uses dm in play mode with instance path", () => {
    const prompt = buildPrimarySystemPrompt({
      agentRegistry: registry,
      gameMode: "play",
      activeGameSlug: "ring_adventure",
      activeGameSkill: "dnd",
      skillsSection: "## Skills",
    })
    expect(prompt).toContain("DM")
    expect(prompt).toContain("skills/dnd/instances/ring_adventure")
    expect(prompt).toContain("same language as the player")
    expect(prompt).toContain('skill("map")')
    expect(prompt).toContain("dnd-runtime")
  })
})
