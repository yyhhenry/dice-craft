import { describe, test, expect } from "bun:test"
import { AgentRegistry, type AgentInfo } from "../../src/agent/agent"

describe("AgentRegistry", () => {
  test("register and get agent", () => {
    const registry = new AgentRegistry()
    const agent: AgentInfo = {
      name: "explore",
      description: "Research agent",
      mode: "subagent",
      systemPrompt: "You are an explorer.",
    }

    registry.register(agent)

    expect(registry.get("explore")).toEqual(agent)
  })

  test("get returns undefined for unknown agent", () => {
    const registry = new AgentRegistry()
    expect(registry.get("nonexistent")).toBeUndefined()
  })

  test("list returns all registered agents", () => {
    const registry = new AgentRegistry()
    const agent1: AgentInfo = { name: "a", description: "A", mode: "primary" }
    const agent2: AgentInfo = { name: "b", description: "B", mode: "subagent" }

    registry.register(agent1)
    registry.register(agent2)

    const list = registry.list()
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(agent1)
    expect(list).toContainEqual(agent2)
  })

  test("listByMode filters correctly", () => {
    const registry = new AgentRegistry()
    const primary: AgentInfo = { name: "build", description: "Builder", mode: "primary" }
    const subagent: AgentInfo = { name: "explore", description: "Explorer", mode: "subagent" }
    const all: AgentInfo = { name: "shared", description: "Shared", mode: "all" }

    registry.register(primary)
    registry.register(subagent)
    registry.register(all)

    expect(registry.listByMode("primary")).toContainEqual(primary)
    expect(registry.listByMode("primary")).toContainEqual(all)
    expect(registry.listByMode("primary")).not.toContainEqual(subagent)

    expect(registry.listByMode("subagent")).toContainEqual(subagent)
    expect(registry.listByMode("subagent")).toContainEqual(all)
    expect(registry.listByMode("subagent")).not.toContainEqual(primary)
  })

  test("register with same name overwrites previous", () => {
    const registry = new AgentRegistry()
    const agent1: AgentInfo = { name: "test", description: "First", mode: "primary" }
    const agent2: AgentInfo = { name: "test", description: "Second", mode: "subagent" }

    registry.register(agent1)
    registry.register(agent2)

    expect(registry.get("test")?.description).toBe("Second")
    expect(registry.list()).toHaveLength(1)
  })
})
