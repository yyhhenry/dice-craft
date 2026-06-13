import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarText(name: string, override?: string): string {
  if (override && override.length >= 1 && override.length <= 2) return override
  if (!name) return "?"
  const clean = name.replace(/[（(][^）)]*[）)]/g, "").replace(/[\s\p{P}]/gu, "")
  const display = clean || name.replace(/[\s\p{P}]/gu, "")
  if (!display) return name.charAt(0)
  return display.length <= 2 ? display : display.slice(-2)
}
