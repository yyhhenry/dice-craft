import { Plus, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSessions } from "@/hooks/useSessions"

interface SessionListProps {
  workspaceId: string | null
  selectedSessionId: string | null
  onSelect: (id: string, title: string) => void
  onDeleted?: (id: string) => void
}

export function SessionList({
  workspaceId,
  selectedSessionId,
  onSelect,
  onDeleted,
}: SessionListProps) {
  const { sessions, loading, create, remove } = useSessions(workspaceId)

  const handleCreate = async () => {
    const session = await create()
    if (session) {
      onSelect(session.id, session.title)
    }
  }

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    await remove(sessionId)
    if (selectedSessionId === sessionId) {
      onDeleted?.(sessionId)
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
        <div
          key={session.id}
          className={`group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            selectedSessionId === session.id
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          }`}
          role="button"
          onClick={() => onSelect(session.id, session.title)}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{session.title}</span>
          <button
            className="hidden shrink-0 rounded p-0.5 hover:bg-destructive/20 group-hover:block"
            onClick={(e) => handleDelete(e, session.id)}
            title="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  )
}
