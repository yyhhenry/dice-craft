import fs from "fs"
import path from "path"

export type GameMode = "build" | "play"

/** Relative path from workspace root (always forward slashes for agent/workspace use). */
export function instanceRelPath(skill: string, slug: string): string {
  return `skills/${skill}/instances/${slug}`
}

export function instanceAbsPath(workspacePath: string, skill: string, slug: string): string {
  return path.join(workspacePath, instanceRelPath(skill, slug))
}

export function instanceExists(workspacePath: string, skill: string, slug: string): boolean {
  const base = instanceAbsPath(workspacePath, skill, slug)
  return (
    fs.existsSync(path.join(base, "meta.json")) || fs.existsSync(path.join(base, "adventure.json"))
  )
}
