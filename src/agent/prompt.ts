import type { AgentRegistry } from "./registry"
import type { GameMode } from "../game/instance"
import { instanceRelPath } from "../game/instance"

export function buildPrimarySystemPrompt(opts: {
  agentRegistry: AgentRegistry
  gameMode: GameMode
  activeGameSlug?: string
  activeGameSkill?: string
  skillsSection: string
}): string {
  const agentName = opts.gameMode === "play" ? "dm" : "builder"
  const agent = opts.agentRegistry.get(agentName)
  if (!agent?.systemPrompt) {
    throw new Error(`Agent prompt not found: ${agentName}`)
  }

  const parts = [agent.systemPrompt]

  if (opts.gameMode === "play" && opts.activeGameSlug) {
    const skill = opts.activeGameSkill ?? "dnd"
    const rel = instanceRelPath(skill, opts.activeGameSlug)
    parts.push(
      "",
      "## Active Game Instance",
      `Skill pack: ${skill}`,
      `Directory: ${rel}/`,
      "Read all files in this directory before running the adventure.",
      skill === "dnd"
        ? "Load `skill(\"dnd-runtime\")` then `skill(\"map\")` when using the scene canvas."
        : "Load the active skill pack's runtime skill; load `skill(\"map\")` if the game uses grid maps.",
      "",
      "## Language",
      "Use the same language as the player for all player-facing output.",
    )
  } else {
    parts.push(
      "",
      "## Mode",
      "build — create games via skills. Player starts play with `/play <slug>`.",
      "",
      "## Language",
      "Use the same language as the player for all message output.",
    )
  }

  parts.push("", opts.skillsSection)
  return parts.join("\n")
}
