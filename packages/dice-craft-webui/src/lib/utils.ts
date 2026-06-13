import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarText(name: string): string {
  if (!name) return "?"
  // Strip parenthetical notes and punctuation/whitespace
  const clean = name.replace(/[（(][^）)]*[）)]/g, "").replace(/[\s\p{P}]/gu, "")
  const display = clean || name.replace(/[\s\p{P}]/gu, "")
  if (!display) return name.charAt(0)

  const hasChinese = /[一-鿿]/.test(display)
  if (hasChinese) {
    return display.length <= 2 ? display : display.slice(-2)
  }
  if (name.includes(" ")) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("")
  }
  return display.length <= 2 ? display : display.slice(0, 2)
}
