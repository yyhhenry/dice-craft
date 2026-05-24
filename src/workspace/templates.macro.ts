/**
 * Bun macro: reads the templates/ directory at bundle time and returns
 * a map of relative paths → file contents. At runtime, the call is
 * replaced with a literal object — no filesystem access needed.
 */
import fs from "fs"
import path from "path"

export function loadTemplates(): Record<string, string> {
  const templatesDir = path.resolve(import.meta.dir, "../../templates")
  if (!fs.existsSync(templatesDir)) return {}

  const result: Record<string, string> = {}

  function walk(dir: string, prefix: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else {
        result[relPath] = fs.readFileSync(fullPath, "utf-8")
      }
    }
  }

  walk(templatesDir, "")
  return result
}
