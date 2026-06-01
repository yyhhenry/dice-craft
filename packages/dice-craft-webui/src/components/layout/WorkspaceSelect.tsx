import { useState } from "react"
import { Settings, Plus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings"
import type { WorkspaceInfo } from "@/lib/api"

interface WorkspaceSelectProps {
  workspaces: WorkspaceInfo[]
  loading: boolean
  onCreate: (name: string) => Promise<WorkspaceInfo>
  selectedId: string | null
  onSelect: (id: string) => void
}

export function WorkspaceSelect({
  workspaces,
  loading,
  onCreate,
  selectedId,
  onSelect,
}: WorkspaceSelectProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")

  const handleCreate = async () => {
    if (!newName.trim()) return
    const ws = await onCreate(newName.trim())
    setNewName("")
    setCreateOpen(false)
    onSelect(ws.id)
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedId ?? ""}
        onValueChange={onSelect}
        disabled={loading}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={loading ? "Loading..." : "Select workspace"} />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id}>
              {ws.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCreateOpen(true)}
        title="New workspace"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSettingsOpen(true)}
        disabled={!selectedId}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {selectedId && (
        <WorkspaceSettings
          workspaceId={selectedId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Workspace name"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
