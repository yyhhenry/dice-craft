import { Dice5 } from "lucide-react"

export function ScenePlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-muted-foreground">
        <Dice5 className="mx-auto mb-4 h-12 w-12 opacity-20" />
        <p className="text-sm">Select a session to view chat history</p>
      </div>
    </div>
  )
}
