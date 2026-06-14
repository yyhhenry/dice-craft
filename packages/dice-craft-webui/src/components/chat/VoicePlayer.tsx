import { useState, useRef, useEffect, useCallback } from "react"
import { Volume2, Pause, Loader2 } from "lucide-react"

const WAKE_UP_DELAY_MS = 300

function wakeUpAudio(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = new AudioContext()
    const source = ctx.createBufferSource()
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
    setTimeout(() => {
      ctx.close()
      resolve()
    }, WAKE_UP_DELAY_MS)
  })
}

interface VoicePlayerProps {
  url: string
  duration: number
  autoPlay?: boolean
  onEnded?: () => void
}

export function VoicePlayer({ url, duration, autoPlay, onEnded }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const audio = new Audio(url)
    audioRef.current = audio

    audio.addEventListener("timeupdate", () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    })
    audio.addEventListener("ended", () => {
      setPlaying(false)
      setProgress(0)
      onEnded?.()
    })
    audio.addEventListener("canplaythrough", () => setLoading(false))
    audio.addEventListener("waiting", () => setLoading(true))

    if (autoPlay) {
      setLoading(true)
      wakeUpAudio()
        .then(() => audio.play())
        .then(() => {
          setPlaying(true)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }

    return () => {
      audio.pause()
      audio.src = ""
    }
  }, [url, autoPlay, onEnded])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      setLoading(true)
      audio
        .play()
        .then(() => {
          setPlaying(true)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [playing])

  return (
    <div className="mt-1 flex items-center gap-1.5 border-t border-border/40 pt-1">
      <button
        onClick={toggle}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : playing ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Volume2 className="h-3 w-3" />
        )}
      </button>
      <div className="relative flex h-3 flex-1 items-center">
        <div className="absolute inset-x-0 h-px rounded-full bg-foreground/20" />
        <div
          className="absolute left-0 h-1 rounded-full bg-primary/60 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{formatDuration(duration)}</span>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}
