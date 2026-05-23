import fs from "fs"
import path from "path"
import type { Tool, ToolResult } from "./base"

export function createSkillTool(skillsDir: string): Tool {
  return {
    id: "skill",
    description:
      "Load a skill by name from the workspace's agent/skills/ directory. " +
      "Skills are markdown files (SKILL.md) that provide instructions for specific tasks.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the skill to load",
        },
      },
      required: ["name"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const name = args.name as string

      if (!name) {
        return { content: "Error: name is required", isError: true }
      }

      const skillPath = path.join(skillsDir, name, "SKILL.md")

      if (!fs.existsSync(skillPath)) {
        // List available skills
        if (fs.existsSync(skillsDir)) {
          const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
          const available = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
          if (available.length > 0) {
            return {
              content: `Error: Skill "${name}" not found. Available skills: ${available.join(", ")}`,
              isError: true,
            }
          }
        }
        return {
          content: `Error: Skill "${name}" not found. No skills available in ${skillsDir}`,
          isError: true,
        }
      }

      const content = fs.readFileSync(skillPath, "utf-8")
      const baseDir = path.join(skillsDir, name)

      // List other files in the skill directory
      const files: string[] = []
      try {
        const entries = fs.readdirSync(baseDir)
        for (const entry of entries) {
          if (entry !== "SKILL.md") {
            files.push(path.join(baseDir, entry))
          }
        }
      } catch {
        // Ignore errors listing files
      }

      const output = [
        `<skill_content name="${name}">`,
        `# Skill: ${name}`,
        "",
        content.trim(),
        "",
        `Base directory for this skill: ${baseDir}`,
        "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
      ]

      if (files.length > 0) {
        output.push("")
        output.push("<skill_files>")
        output.push(...files)
        output.push("</skill_files>")
      }

      output.push("</skill_content>")

      return { content: output.join("\n") }
    },
  }
}
