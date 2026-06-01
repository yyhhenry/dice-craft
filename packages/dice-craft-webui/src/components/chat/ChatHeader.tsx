import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatHeaderProps {
  title: string
  onBack: () => void
}

export function ChatHeader({ title, onBack }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h2 className="flex-1 truncate text-sm font-medium">{title}</h2>
    </div>
  )
}
