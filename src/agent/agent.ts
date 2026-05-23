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
}
