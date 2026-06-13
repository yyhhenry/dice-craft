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
  const [ttsApiBaseUrl, setTtsApiBaseUrl] = useState("")
  const [ttsApiKey, setTtsApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [showTtsKey, setShowTtsKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      setApiBaseUrl(config.apiBaseUrl)
      setApiKey(config.apiKey)
      setModelName(config.modelName)
      setContextWindowTokens(String(config.contextWindowTokens ?? 1000000))
      setTtsApiBaseUrl(config.tts?.apiBaseUrl ?? "")
      setTtsApiKey(config.tts?.apiKey ?? "")
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      const tts = ttsApiKey
        ? { apiBaseUrl: ttsApiBaseUrl || "https://api.xiaomimimo.com/v1", apiKey: ttsApiKey }
        : undefined
      await save({
        apiBaseUrl,
        apiKey,
        modelName,
        contextWindowTokens: Number.parseInt(contextWindowTokens, 10) || 1000000,
        tts,
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
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">TTS (Voice)</p>
            <p className="text-xs text-muted-foreground">Optional. Enable character voice generation.</p>
            <div className="space-y-2">
              <Label htmlFor="ttsApiBaseUrl">TTS API Base URL</Label>
              <Input
                id="ttsApiBaseUrl"
                value={ttsApiBaseUrl}
                onChange={(e) => setTtsApiBaseUrl(e.target.value)}
                placeholder="https://api.xiaomimimo.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ttsApiKey">TTS API Key</Label>
              <div className="relative">
                <Input
                  id="ttsApiKey"
                  type={showTtsKey ? "text" : "password"}
                  value={ttsApiKey}
                  onChange={(e) => setTtsApiKey(e.target.value)}
                  placeholder="Leave empty to disable TTS"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  onClick={() => setShowTtsKey(!showTtsKey)}
                >
                  {showTtsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
