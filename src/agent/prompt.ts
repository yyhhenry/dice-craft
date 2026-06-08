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
      "Use `skill(\"dnd-runtime\")` for roll/state script usage.",
      "",
      "## 语言",
      "玩家使用中文交流。你作为 DM，所有面向玩家的输出（message、update_scene 文案、notify 指示）必须使用简体中文，不得使用英文。",
    )
  } else {
    parts.push("", "## Mode", "build — create games via skills. Player starts play with `/play <slug>`.")
  }

  parts.push("", opts.skillsSection)
  return parts.join("\n")
}
