import { useState, useEffect } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Sidebar } from "@/components/layout/Sidebar"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { ScenePlaceholder } from "@/components/scene/ScenePlaceholder"
import { useWorkspaces } from "@/hooks/useWorkspaces"
import { TooltipProvider } from "@/components/ui/tooltip"

export function App() {
  const { workspaces, loading, create } = useWorkspaces()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0]!.id)
    }
  }, [workspaces, selectedWorkspaceId])

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar — collapsible */}
        {sidebarOpen && (
          <div className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar">
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
          </div>
        )}

        {/* Main area — resizable canvas + chat */}
        <div className="relative flex-1 overflow-hidden">
          {/* Toggle sidebar button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-2 z-10 h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>

          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={60} minSize={20}>
              <ScenePlaceholder />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              {selectedSessionId && selectedWorkspaceId ? (
                <ChatPanel
                  sessionId={selectedSessionId}
                  workspaceId={selectedWorkspaceId}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a session to start chatting
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
