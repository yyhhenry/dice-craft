export interface AgentInfo {
  name: string
  description: string
  mode: "primary" | "subagent" | "all"
  systemPrompt?: string
}

export class AgentRegistry {
  private agents = new Map<string, AgentInfo>()

  register(agent: AgentInfo): void {
    this.agents.set(agent.name, agent)
  }

  get(name: string): AgentInfo | undefined {
    return this.agents.get(name)
  }

  list(): AgentInfo[] {
    return Array.from(this.agents.values())
  }

  listByMode(mode: "primary" | "subagent" | "all"): AgentInfo[] {
    return this.list().filter((a) => a.mode === mode || a.mode === "all")
  }

  getPrimary(): AgentInfo | undefined {
    return this.list().find((a) => a.mode === "primary")
  }
}

import builderPrompt from "./prompt/builder.txt" with { type: "text" }
import explorePrompt from "./prompt/explore.txt" with { type: "text" }
import reviewPrompt from "./prompt/review.txt" with { type: "text" }

export function loadAgents(): AgentRegistry {
  const registry = new AgentRegistry()

  registry.register({
    name: "builder",
    description: "Primary agent for building tabletop games and running as GM",
    mode: "primary",
    systemPrompt: builderPrompt,
  })

  registry.register({
    name: "explore",
    description: "Research and search for information",
    mode: "subagent",
    systemPrompt: explorePrompt,
  })

  registry.register({
    name: "review",
    description: "Review code and find issues",
    mode: "subagent",
    systemPrompt: reviewPrompt,
  })

  return registry
}
