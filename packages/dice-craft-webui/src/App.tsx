import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { ScenePlaceholder } from "@/components/scene/ScenePlaceholder"
import { useWorkspaces } from "@/hooks/useWorkspaces"

export function App() {
  const { workspaces, loading, create } = useWorkspaces()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0]!.id)
    }
  }, [workspaces, selectedWorkspaceId])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaces={workspaces}
        workspacesLoading={loading}
        onCreateWorkspace={create}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectWorkspace={(id) => {
          setSelectedWorkspaceId(id)
          setSelectedSessionId(null)
        }}
        selectedSessionId={selectedSessionId}
        onSelectSession={(id) => setSelectedSessionId(id)}
        onSessionDeleted={() => setSelectedSessionId(null)}
      />
      <main className="flex-1 overflow-hidden">
        <ScenePlaceholder />
      </main>
      {selectedSessionId && selectedWorkspaceId && (
        <ChatPanel
          sessionId={selectedSessionId}
          workspaceId={selectedWorkspaceId}
        />
      )}
    </div>
  )
}

export default App
