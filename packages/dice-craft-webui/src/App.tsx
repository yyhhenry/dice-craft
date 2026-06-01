import { useState, useEffect } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeftOpen, MapIcon } from "lucide-react"
import { Sidebar } from "@/components/layout/Sidebar"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { PlaySurface } from "@/components/scene/PlaySurface"
import { useWorkspaces } from "@/hooks/useWorkspaces"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useScene } from "@/hooks/useScene"
import { TooltipProvider } from "@/components/ui/tooltip"

type ActivePanel = "scene" | "chat"

export function App() {
  const { workspaces, loading, create } = useWorkspaces()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<ActivePanel>("scene")

  const {
    messages: wsMessages,
    status,
    scene: wsScene,
    connected,
    send,
  } = useWebSocket(selectedSessionId, selectedWorkspaceId)
  const scene = useScene(selectedSessionId, wsScene)

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0]!.id)
    }
  }, [workspaces, selectedWorkspaceId])

  useEffect(() => {
    if (selectedSessionId) {
      setActivePanel("chat")
    }
  }, [selectedSessionId])

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
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

        <div className="relative flex-1 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>

          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={60} minSize={20}>
              <div className="relative h-full" onClick={() => setActivePanel("scene")}>
                {activePanel === "scene" && (
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <MapIcon className="h-7 w-7 text-foreground" />
                    <span className="text-xs font-medium text-foreground">Scene</span>
                  </div>
                )}
                <PlaySurface scene={scene} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="h-full" onClick={() => setActivePanel("chat")}>
                {selectedSessionId ? (
                  <ChatPanel
                    sessionId={selectedSessionId}
                    wsMessages={wsMessages}
                    status={status}
                    connected={connected}
                    send={send}
                    active={activePanel === "chat"}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Select a session to start chatting
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
