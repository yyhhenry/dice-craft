import { useState, useEffect } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeftOpen, Dice5, MessageSquareText } from "lucide-react"
import { Sidebar } from "@/components/layout/Sidebar"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { ScenePlaceholder } from "@/components/scene/ScenePlaceholder"
import { useWorkspaces } from "@/hooks/useWorkspaces"
import { TooltipProvider } from "@/components/ui/tooltip"

type ActivePanel = "scene" | "chat"

export function App() {
  const { workspaces, loading, create } = useWorkspaces()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<ActivePanel>("scene")

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
              <div
                className="flex h-full flex-col"
                onClick={() => setActivePanel("scene")}
              >
                <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
                  <Dice5 className={`h-4 w-4 transition-colors ${activePanel === "scene" ? "text-foreground" : "text-muted-foreground/40"}`} />
                  <span className={`text-xs font-medium transition-colors ${activePanel === "scene" ? "text-foreground" : "text-muted-foreground/40"}`}>
                    Game Scene
                  </span>
                </div>
                <div className="flex-1">
                  <ScenePlaceholder />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              <div
                className="flex h-full flex-col"
                onClick={() => setActivePanel("chat")}
              >
                <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
                  <MessageSquareText className={`h-4 w-4 transition-colors ${activePanel === "chat" ? "text-foreground" : "text-muted-foreground/40"}`} />
                  <span className={`text-xs font-medium transition-colors ${activePanel === "chat" ? "text-foreground" : "text-muted-foreground/40"}`}>
                    Chat
                  </span>
                </div>
                <div className="min-h-0 flex-1">
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
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
