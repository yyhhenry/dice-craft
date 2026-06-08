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
import dmPrompt from "./prompt/dm.txt" with { type: "text" }
import explorePrompt from "./prompt/explore.txt" with { type: "text" }
import reviewPrompt from "./prompt/review.txt" with { type: "text" }
import npcPrompt from "./prompt/npc.txt" with { type: "text" }
import generalPrompt from "./prompt/general.txt" with { type: "text" }

export function loadAgents(): AgentRegistry {
  const registry = new AgentRegistry()

  registry.register({
    name: "builder",
    description: "Creates tabletop games from player descriptions (build mode)",
    mode: "primary",
    systemPrompt: builderPrompt,
  })

  registry.register({
    name: "dm",
    description: "Runs adventures from game instance files (play mode)",
    mode: "subagent",
    systemPrompt: dmPrompt,
  })

  registry.register({
    name: "explore",
    description: "Research and search for information",
    mode: "subagent",
    systemPrompt: explorePrompt,
  })

  registry.register({
    name: "general",
    description: "General-purpose subagent for concrete implementation tasks",
    mode: "subagent",
    systemPrompt: generalPrompt,
  })

  registry.register({
    name: "review",
    description: "Review game content for logic, balance, and info leaks",
    mode: "subagent",
    systemPrompt: reviewPrompt,
  })

  registry.register({
    name: "npc",
    description: "NPC character in a game",
    mode: "subagent",
    systemPrompt: npcPrompt,
  })

  return registry
}
