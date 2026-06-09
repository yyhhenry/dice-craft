import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { useWorkspaceConfig } from "@/hooks/useWorkspaceConfig"

interface WorkspaceSettingsProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceSettings({ workspaceId, open, onOpenChange }: WorkspaceSettingsProps) {
  const { config, save } = useWorkspaceConfig(workspaceId)
  const [apiBaseUrl, setApiBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [modelName, setModelName] = useState("")
  const [contextWindowTokens, setContextWindowTokens] = useState("1000000")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      setApiBaseUrl(config.apiBaseUrl)
      setApiKey(config.apiKey)
      setModelName(config.modelName)
      setContextWindowTokens(String(config.contextWindowTokens))
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      await save({
        apiBaseUrl,
        apiKey,
        modelName,
        contextWindowTokens: Number.parseInt(contextWindowTokens, 10),
      })
      onOpenChange(false)
    } catch {
      // error handled by hook
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="apiBaseUrl">API Base URL</Label>
            <Input
              id="apiBaseUrl"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.xiaomimimo.com/v1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="modelName">Model Name</Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="mimo-v2.5-pro"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contextWindowTokens">Context Window Tokens</Label>
            <Input
              id="contextWindowTokens"
              type="number"
              min={1}
              step={1000}
              value={contextWindowTokens}
              onChange={(e) => setContextWindowTokens(e.target.value)}
              placeholder="1000000"
            />
            <p className="text-xs text-muted-foreground">Compaction starts at 80% of this value.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
