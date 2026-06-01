import { Plus, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSessions } from "@/hooks/useSessions"

interface SessionListProps {
  workspaceId: string | null
  selectedSessionId: string | null
  onSelect: (id: string, title: string) => void
}

export function SessionList({
  workspaceId,
  selectedSessionId,
  onSelect,
}: SessionListProps) {
  const { sessions, loading, create } = useSessions(workspaceId)

  const handleCreate = async () => {
    const session = await create()
    if (session) {
      onSelect(session.id, session.title)
    }
  }

  if (!workspaceId) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a workspace
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="p-2">
      <Button
        variant="ghost"
        size="sm"
        className="mb-1 w-full justify-start gap-2"
        onClick={handleCreate}
      >
        <Plus className="h-4 w-4" />
        New session
      </Button>
      {sessions.length === 0 && (
        <div className="px-3 py-2 text-center text-xs text-muted-foreground">
          No sessions yet
        </div>
      )}
      {sessions.map((session) => (
        <button
          key={session.id}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            selectedSessionId === session.id
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          }`}
          onClick={() => onSelect(session.id, session.title)}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate">{session.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {session.messageCount}
          </span>
        </button>
      ))}
    </div>
  )
}
