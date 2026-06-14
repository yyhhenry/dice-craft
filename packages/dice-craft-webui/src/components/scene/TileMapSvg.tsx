import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import type { SceneMap, SceneCharacter } from "@shared/schemas"
import { CELL_SIZE, PATTERN_SIZE, ROLE_COLORS, OVERLAY_SYMBOLS, resolveTerrainPattern } from "./terrain"

export interface CellClickInfo {
  x: number
  y: number
  screenX: number
  screenY: number
}

export interface CharacterClickInfo {
  character: SceneCharacter
  screenX: number
  screenY: number
}

interface TileMapSvgProps {
  map: SceneMap
  characters: SceneCharacter[]
  replayTrigger?: number
  onCellClick?: (info: CellClickInfo) => void
  onCharacterClick?: (info: CharacterClickInfo) => void
}

function parseLocation(loc?: string): { x: number; y: number } | null {
  if (!loc) return null
  const parts = loc.split(",")
  if (parts.length !== 2) return null
  const x = parseInt(parts[0]!, 10)
  const y = parseInt(parts[1]!, 10)
  if (isNaN(x) || isNaN(y)) return null
  return { x, y }
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const transformed = pt.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export function TileMapSvg({ map, characters, replayTrigger, onCellClick, onCharacterClick }: TileMapSvgProps) {
  const { width = 0, height = 0, cells = [], overlays = [], labels = [] } = map
  const C = CELL_SIZE

  const svgW = width * C
  const svgH = height * C
  const PAD = C * 1.5

  const defaultVB = { x: -PAD, y: -PAD, w: svgW + PAD * 2, h: svgH + PAD * 2 }
  const [viewBox, setViewBox] = useState(defaultVB)
  const [dragging, setDragging] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [animPositions, setAnimPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const prevPathsRef = useRef<Map<string, string>>(new Map())
  const dragStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const dragMoved = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const prevDims = useRef({ w: svgW, h: svgH })
  if (prevDims.current.w !== svgW || prevDims.current.h !== svgH) {
    prevDims.current = { w: svgW, h: svgH }
    setViewBox({ x: -PAD, y: -PAD, w: svgW + PAD * 2, h: svgH + PAD * 2 })
  }

  const terrainPatterns = useMemo(() => {
    const ids = new Set(["void", ...cells.map((c) => c.terrain)])
    return Array.from(ids).map((id) => ({ id, ...resolveTerrainPattern(id) }))
  }, [cells])

  const visibleChars = useMemo(() => characters.filter((c) => !c.hidden), [characters])

  // Detect new movePaths and trigger animation
  useEffect(() => {
    const newAnims: { charId: string; path: { x: number; y: number }[] }[] = []

    for (const ch of characters) {
      if (!ch.movePath || ch.movePath.length < 2) continue
      const pathKey = ch.movePath.join("|")
      if (prevPathsRef.current.get(ch.id) === pathKey) continue
      prevPathsRef.current.set(ch.id, pathKey)

      const parsed = ch.movePath.map(parseLocation).filter(Boolean) as { x: number; y: number }[]
      if (parsed.length >= 2) {
        newAnims.push({ charId: ch.id, path: parsed })
      }
    }

    if (newAnims.length === 0) return

    // Start all animations
    const STEP_MS = 250
    let step = 0
    const maxSteps = Math.max(...newAnims.map((a) => a.path.length))

    // Set initial positions
    setAnimPositions((prev) => {
      const next = new Map(prev)
      for (const anim of newAnims) {
        next.set(anim.charId, anim.path[0]!)
      }
      return next
    })

    const interval = setInterval(() => {
      step++
      if (step >= maxSteps - 1) {
        clearInterval(interval)
        setAnimPositions((prev) => {
          const next = new Map(prev)
          for (const anim of newAnims) {
            next.delete(anim.charId)
          }
          return next
        })
        return
      }
      setAnimPositions((prev) => {
        const next = new Map(prev)
        for (const anim of newAnims) {
          if (step < anim.path.length) {
            next.set(anim.charId, anim.path[step]!)
          }
        }
        return next
      })
    }, STEP_MS)

    return () => clearInterval(interval)
  }, [characters])

  // Replay all current movePaths when replayTrigger changes
  useEffect(() => {
    if (replayTrigger === undefined || replayTrigger === 0) return

    const anims: { charId: string; path: { x: number; y: number }[] }[] = []
    for (const ch of characters) {
      if (!ch.movePath || ch.movePath.length < 2) continue
      const parsed = ch.movePath.map(parseLocation).filter(Boolean) as { x: number; y: number }[]
      if (parsed.length >= 2) anims.push({ charId: ch.id, path: parsed })
    }
    if (anims.length === 0) return

    const STEP_MS = 250
    let step = 0
    const maxSteps = Math.max(...anims.map((a) => a.path.length))

    setAnimPositions(() => {
      const m = new Map<string, { x: number; y: number }>()
      for (const a of anims) m.set(a.charId, a.path[0]!)
      return m
    })

    const interval = setInterval(() => {
      step++
      if (step >= maxSteps - 1) {
        clearInterval(interval)
        setAnimPositions(new Map())
        return
      }
      setAnimPositions(() => {
        const m = new Map<string, { x: number; y: number }>()
        for (const a of anims) {
          if (step < a.path.length) m.set(a.charId, a.path[step]!)
        }
        return m
      })
    }, STEP_MS)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayTrigger])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return

      const pt = svgPoint(svg, e.clientX, e.clientY)
      if (!pt) return

      const factor = e.deltaY > 0 ? 1.1 : 0.9
      const minW = svgW * 0.25
      const maxW = defaultVB.w * 2
      const nw = Math.max(minW, Math.min(maxW, viewBox.w * factor))
      const nh = (nw / svgW) * svgH

      setViewBox({
        x: pt.x - ((pt.x - viewBox.x) / viewBox.w) * nw,
        y: pt.y - ((pt.y - viewBox.y) / viewBox.h) * nh,
        w: nw,
        h: nh,
      })
    },
    [viewBox, svgW, svgH, defaultVB.w],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setDragging(true)
      dragMoved.current = false
      dragStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y }
    },
    [viewBox],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current
      if (!svg) return

      if (dragging) {
        dragMoved.current = true
        const rect = svg.getBoundingClientRect()
        const scale = viewBox.w / rect.width
        const dx = (e.clientX - dragStart.current.x) * scale
        const dy = (e.clientY - dragStart.current.y) * scale
        setViewBox((v) => ({
          ...v,
          x: dragStart.current.vx - dx,
          y: dragStart.current.vy - dy,
        }))
      } else {
        // Hover detection
        const pt = svgPoint(svg, e.clientX, e.clientY)
        if (pt) {
          const cellX = Math.floor(pt.x / C)
          const cellY = Math.floor(pt.y / C)
          if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) {
            setHoveredCell({ x: cellX, y: cellY })
          } else {
            setHoveredCell(null)
          }
        }
      }
    },
    [dragging, viewBox, C, width, height],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const wasDragging = dragMoved.current
      setDragging(false)
      if (wasDragging) return

      // Click (not drag) — determine what was clicked
      const svg = svgRef.current
      if (!svg) return
      const pt = svgPoint(svg, e.clientX, e.clientY)
      if (!pt) return
      const cellX = Math.floor(pt.x / C)
      const cellY = Math.floor(pt.y / C)

      // Check if a character was clicked
      const clickedChar = visibleChars.find((ch) => {
        const pos = parseLocation(ch.location)
        if (!pos) return false
        const cx = pos.x * C + C / 2
        const cy = pos.y * C + C / 2
        const dist = Math.hypot(pt.x - cx, pt.y - cy)
        return dist < C * 0.4
      })

      if (clickedChar && onCharacterClick) {
        onCharacterClick({ character: clickedChar, screenX: e.clientX, screenY: e.clientY })
      } else if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height && onCellClick) {
        onCellClick({ x: cellX, y: cellY, screenX: e.clientX, screenY: e.clientY })
      }
    },
    [C, width, height, visibleChars, onCellClick, onCharacterClick],
  )

  const handleMouseLeave = useCallback(() => {
    setDragging(false)
    setHoveredCell(null)
  }, [])

  if (width <= 0 || height <= 0) return null

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      className="h-full w-full select-none"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pattern definitions — pixel art tiles */}
      <defs>
        {terrainPatterns.map((t) => (
          <pattern
            key={t.id}
            id={`terrain-${t.id}`}
            width={PATTERN_SIZE}
            height={PATTERN_SIZE}
            patternUnits="userSpaceOnUse"
          >
            {t.pixels.map((row, y) =>
              Array.from(row).map((ch, x) => (
                <rect key={y * PATTERN_SIZE + x} x={x} y={y} width={1} height={1} fill={t.palette[ch] ?? "#ff00ff"} />
              )),
            )}
          </pattern>
        ))}
      </defs>

      {/* Grid background */}
      <rect x={0} y={0} width={svgW} height={svgH} fill="url(#terrain-void)" />

      {/* Terrain cells */}
      {cells.map((cell) => (
        <rect
          key={`t-${cell.x}-${cell.y}`}
          x={cell.x * C}
          y={cell.y * C}
          width={C}
          height={C}
          fill={`url(#terrain-${cell.terrain})`}
          shapeRendering="crispEdges"
        />
      ))}

      {/* Grid lines */}
      <g stroke="rgba(255,255,255,0.08)" strokeWidth={0.5}>
        {Array.from({ length: width + 1 }, (_, i) => (
          <line key={`gv-${i}`} x1={i * C} y1={0} x2={i * C} y2={svgH} />
        ))}
        {Array.from({ length: height + 1 }, (_, i) => (
          <line key={`gh-${i}`} x1={0} y1={i * C} x2={svgW} y2={i * C} />
        ))}
      </g>

      {/* Overlays */}
      {overlays.map((o) => (
        <g key={`o-${o.id}`}>
          <text
            x={o.x * C + C / 2}
            y={o.y * C + C / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={C * 0.5}
            style={{ pointerEvents: "none" }}
          >
            {OVERLAY_SYMBOLS[o.type] ?? "?"}
          </text>
          {o.label && (
            <text
              x={o.x * C + C - 2}
              y={o.y * C + C - 2}
              textAnchor="end"
              fontSize={C * 0.22}
              fill="#fff"
              style={{ pointerEvents: "none" }}
            >
              {o.label}
            </text>
          )}
        </g>
      ))}

      {/* Map labels */}
      {labels.map((l) => (
        <text
          key={`l-${l.id}`}
          x={l.x * C + C / 2}
          y={l.y * C + C / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={C * 0.3}
          fill={l.style === "alert" ? "#ff6060" : "#ffffff"}
          fontWeight={l.style === "area" ? "bold" : "normal"}
          opacity={0.9}
          style={{ pointerEvents: "none" }}
        >
          {l.text}
        </text>
      ))}

      {/* Hover highlight */}
      {hoveredCell && !dragging && (
        <rect
          x={hoveredCell.x * C}
          y={hoveredCell.y * C}
          width={C}
          height={C}
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Character tokens */}
      {visibleChars.map((ch) => {
        const animPos = animPositions.get(ch.id)
        const pos = animPos ?? parseLocation(ch.location)
        if (!pos) return null
        const cx = pos.x * C + C / 2
        const cy = pos.y * C + C / 2
        const r = C * 0.35
        const color = ROLE_COLORS[ch.role] ?? ROLE_COLORS.neutral
        const avatarText = ch.avatarText
        const fontSize = avatarText.length > 1 ? C * 0.22 : C * 0.28
        return (
          <g key={`ch-${ch.id}`} style={{ transition: animPos ? "transform 0.2s ease" : "none" }}>
            <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={1.5} />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fill="#fff"
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {avatarText}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
