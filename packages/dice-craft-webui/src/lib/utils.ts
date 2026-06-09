import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarText(name: string): string {
  if (!name) return "?"
  const hasChinese = /[一-鿿]/.test(name)
  if (hasChinese) {
    return name.length <= 2 ? name : name.slice(-2)
  }
  if (name.includes(" ")) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("")
  }
  return name.length <= 2 ? name : name.slice(0, 2)
}
