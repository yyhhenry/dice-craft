import type { GameMode } from "./instance"

export interface ParsedUserCommand {
  kind: "play" | "build" | "message"
  slug?: string
  content: string
}

export function parseUserCommand(content: string): ParsedUserCommand {
  const trimmed = content.trim()

  const playMatch = trimmed.match(/^\/play(?:\s+([a-z][a-z0-9_-]*))?$/i)
  if (playMatch) {
    return { kind: "play", slug: playMatch[1]?.toLowerCase(), content: trimmed }
  }

  if (/^\/build$/i.test(trimmed)) {
    return { kind: "build", content: trimmed }
  }

  return { kind: "message", content: trimmed }
}

export function slugifyTheme(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "adventure"
  )
}

export type { GameMode }
