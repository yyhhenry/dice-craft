import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatHeaderProps {
  title: string
  onBack: () => void
  children?: ReactNode
}

export function ChatHeader({ title, onBack, children }: ChatHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h2 className="flex-1 truncate text-sm font-medium">{title}</h2>
      {children}
    </div>
  )
}
