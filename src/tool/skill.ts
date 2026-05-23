import fs from "fs"
import path from "path"
import matter from "gray-matter"
import type { Tool, ToolResult } from "./base"

export interface SkillInfo {
  name: string
  description: string
  /** Relative path to SKILL.md from workspace root */
  location: string
  content: string
}

/** Scan skillsDir for SKILL.md files, parse frontmatter, return skill list */
export function discoverSkills(skillsDir: string): SkillInfo[] {
  if (!fs.existsSync(skillsDir)) return []

  const results: SkillInfo[] = []

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.name === "SKILL.md") {
        try {
          const raw = fs.readFileSync(fullPath, "utf-8")
          const { data, content } = matter(raw)
          const location = path.relative(skillsDir, fullPath)
          results.push({
            name: data.name ?? path.basename(path.dirname(fullPath)),
            description: data.description ?? "",
            location,
            content,
          })
        } catch {
          // Skip invalid skill files
        }
      }
    }
  }

  scan(skillsDir)
  return results.sort((a, b) => a.name.localeCompare(b.name))
}

/** Format skill list for system prompt */
export function fmtSkills(skills: SkillInfo[], verbose: boolean): string {
  const described = skills.filter((s) => s.description)
  if (described.length === 0) return "No skills are currently available."

  if (verbose) {
    return [
      "<available_skills>",
      ...described
        .flatMap((skill) => [
          "  <skill>",
          `    <name>${skill.name}</name>`,
          `    <description>${skill.description}</description>`,
          `    <location>${skill.location}</location>`,
          "  </skill>",
        ]),
      "</available_skills>",
    ].join("\n")
  }

  return [
    "## Available Skills",
    ...described.map((s) => `- **${s.name}**: ${s.description}`),
  ].join("\n")
}

export function createSkillTool(skillsDir: string): Tool {
  return {
    id: "skill",
    description:
      "Load a specialized skill when the task at hand matches one of the available skills. " +
      "Use this tool to inject the skill's instructions and resources into current conversation. " +
      "The output may contain detailed workflow guidance as well as references to scripts, files etc in the same directory as the skill.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the skill from available_skills. Leave empty to list all available skills.",
        },
      },
      required: [],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const name = args.name as string | undefined
      const skills = discoverSkills(skillsDir)

      // List available skills if no name provided
      if (!name) {
        return {
          content: fmtSkills(skills, true),
        }
      }
      const skill = skills.find((s) => s.name === name)

      if (!skill) {
        const available = skills.map((s) => s.name)
        return {
          content: `<error>Skill "${name}" not found. Available skills: ${available.join(", ") || "none"}</error>`,
          isError: true,
        }
      }

      const dir = path.dirname(skill.location)
      const base = `skills/${dir}`
      const skillDir = path.join(skillsDir, dir)

      // List files in the skill directory (excluding SKILL.md)
      const files: string[] = []
      try {
        const entries = fs.readdirSync(skillDir)
        for (const entry of entries) {
          if (entry !== "SKILL.md") {
            files.push(`<file>skills/${path.join(dir, entry)}</file>`)
          }
        }
      } catch {
        // Ignore errors
      }

      const output = [
        `<skill_content name="${skill.name}">`,
        "",
        skill.content.trim(),
        "",
        `Base directory for this skill: ${base}`,
        "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
        "Note: file list is sampled.",
        "",
        "<skill_files>",
        files.length > 0 ? files.join("\n") : "(no additional files)",
        "</skill_files>",
        "</skill_content>",
      ]

      return { content: output.join("\n") }
    },
  }
}
