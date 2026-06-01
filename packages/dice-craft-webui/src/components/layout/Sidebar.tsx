import { WorkspaceSelect } from "./WorkspaceSelect"
import { SessionList } from "@/components/session/SessionList"
import type { WorkspaceInfo } from "@/lib/api"

interface SidebarProps {
  workspaces: WorkspaceInfo[]
  workspacesLoading: boolean
  onCreateWorkspace: (name: string) => Promise<WorkspaceInfo>
  selectedWorkspaceId: string | null
  onSelectWorkspace: (id: string) => void
  selectedSessionId: string | null
  onSelectSession: (id: string, title: string) => void
}

export function Sidebar({
  workspaces,
  workspacesLoading,
  onCreateWorkspace,
  selectedWorkspaceId,
  onSelectWorkspace,
  selectedSessionId,
  onSelectSession,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="border-b p-3">
        <WorkspaceSelect
          workspaces={workspaces}
          loading={workspacesLoading}
          onCreate={onCreateWorkspace}
          selectedId={selectedWorkspaceId}
          onSelect={onSelectWorkspace}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <SessionList
          workspaceId={selectedWorkspaceId}
          selectedSessionId={selectedSessionId}
          onSelect={onSelectSession}
        />
      </div>
    </aside>
  )
}
