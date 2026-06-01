import { Dice5 } from "lucide-react"

export function ScenePlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-muted-foreground/50">
        <Dice5 className="mx-auto mb-3 h-16 w-16" />
        <p className="text-sm font-medium">Game Scene</p>
        <p className="mt-1 text-xs">TODO: Game canvas will be rendered here</p>
      </div>
    </div>
  )
}
