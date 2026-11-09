import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import type { GraphEdge, GraphNode, MemoryGraph, Film } from '@/types'
import { cn, truncate } from '@/lib/format'
import { frameSrc } from '@/lib/media'

type View = { x: number; y: number; k: number }
type Point = { x: number; y: number }

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const radiusOf = (node: GraphNode): number => {
  if (node.kind === 'film') return 24
  if (node.kind === 'theme') return 6 + node.weight * 6
  return 3 + node.weight * 4
}

/**
 * Concentric constellation.
 *
 * Films sit on the outer ring like frames on a reel, themes form the middle
 * ground, and moods gather at the centre. A force simulation was tried first,
 * but at this node count it compressed everything into an unreadable knot —
 * this layout keeps the same data and interactions while staying legible.
 */
export const MemoryGraphView = ({
  graph,
  films,
  selectedId,
  onSelect,
  className,
}: {
  graph: MemoryGraph
  films: Film[]
  selectedId: string | null
  onSelect: (node: GraphNode | null) => void
  className?: string
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const movedRef = useRef(false)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [dragged, setDragged] = useState<Record<string, Point>>({})
  const [hovered, setHovered] = useState<string | null>(null)

  viewRef.current = view
  const filmMap = useMemo(() => new Map(films.map((f) => [f.id, f])), [films])
  const labelledThemes = useMemo(
    () =>
      new Set(
        graph.nodes
          .filter((n) => n.kind === 'theme')
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 10)
          .map((n) => n.id),
      ),
    [graph.nodes],
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* Reset manual drags whenever the underlying graph or canvas changes. */
  useLayoutEffect(() => {
    setDragged({})
  }, [graph.nodes, size.w, size.h])

  const layout = useMemo(() => {
    const map = new Map<string, Point>()
    if (size.w === 0 || size.h === 0) return map
    const cx = size.w / 2
    const cy = size.h / 2
    const rings = {
      film: { rx: size.w * 0.37, ry: size.h * 0.34, start: -90, count: 0 },
      theme: { rx: size.w * 0.245, ry: size.h * 0.245, start: -78, count: 0 },
      mood: { rx: size.w * 0.115, ry: size.h * 0.125, start: -70, count: 0 },
    }
    const groups: Record<GraphNode['kind'], GraphNode[]> = { film: [], theme: [], mood: [] }
    for (const node of graph.nodes) groups[node.kind].push(node)

    /* Larger themes sit slightly further out; films are sorted by title for
       a stable, recognisable arrangement across visits. */
    groups.film.sort((a, b) => a.label.localeCompare(b.label))
    groups.theme.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    groups.mood.sort((a, b) => a.label.localeCompare(b.label))

    for (const kind of ['film', 'theme', 'mood'] as const) {
      const ring = rings[kind]
      const nodes = groups[kind]
      nodes.forEach((node, index) => {
        const step = 360 / Math.max(nodes.length, 1)
        const base = ring.start + index * step
        const jitter = (hash(node.id) - 0.5) * Math.min(step * 0.18, 4)
        const angle = ((base + jitter) * Math.PI) / 180
        const scale = kind === 'film' ? 0.97 + node.weight * 0.04 : 0.96 + node.weight * 0.08
        map.set(node.id, {
          x: cx + Math.cos(angle) * ring.rx * scale,
          y: cy + Math.sin(angle) * ring.ry * scale,
        })
      })
    }
    return map
  }, [graph.nodes, size.w, size.h])

  const positions = useMemo(() => {
    const merged = new Map<string, Point>()
    for (const node of graph.nodes) {
      const base = layout.get(node.id) ?? { x: size.w / 2, y: size.h / 2 }
      merged.set(node.id, dragged[node.id] ?? base)
    }
    return merged
  }, [graph.nodes, layout, dragged, size.w, size.h])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      setView((current) => {
        const factor = Math.exp(-event.deltaY * 0.0014)
        const k = Math.min(2.6, Math.max(0.45, current.k * factor))
        return {
          k,
          x: mx - (mx - current.x) * (k / current.k),
          y: my - (my - current.y) * (k / current.k),
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - viewRef.current.x) / viewRef.current.k,
      y: (clientY - rect.top - viewRef.current.y) / viewRef.current.k,
    }
  }

  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) return
    const target = event.target as Element
    if (target.closest('[data-node="true"]')) return
    panRef.current = { sx: event.clientX, sy: event.clientY, vx: view.x, vy: view.y }
    movedRef.current = false
    onSelect(null)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* synthetic pointers (tests) have no capture target */
    }
  }

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (drag) {
      const world = toWorld(event.clientX, event.clientY)
      setDragged((current) => ({
        ...current,
        [drag.id]: { x: world.x + drag.ox, y: world.y + drag.oy },
      }))
      movedRef.current = true
      return
    }
    const pan = panRef.current
    if (pan) {
      const dx = event.clientX - pan.sx
      const dy = event.clientY - pan.sy
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true
      setView((current) => ({ ...current, x: pan.vx + dx, y: pan.vy + dy }))
    }
  }

  const endPointer = () => {
    dragRef.current = null
    panRef.current = null
    window.setTimeout(() => {
      movedRef.current = false
    }, 0)
  }

  const zoomBy = (factor: number) => {
    const { w, h } = size
    setView((current) => {
      const k = Math.min(2.6, Math.max(0.45, current.k * factor))
      return {
        k,
        x: w / 2 - (w / 2 - current.x) * (k / current.k),
        y: h / 2 - (h / 2 - current.y) * (k / current.k),
      }
    })
  }

  const neighborIds = useMemo(() => {
    if (!selectedId) return null
    const set = new Set<string>([selectedId])
    for (const edge of graph.edges) {
      if (edge.source === selectedId) set.add(edge.target)
      if (edge.target === selectedId) set.add(edge.source)
    }
    return set
  }, [selectedId, graph.edges])

  const edgePath = (edge: GraphEdge, a: Point, b: Point) => {
    if (edge.kind !== 'film-film') return `M${a.x},${a.y} L${b.x},${b.y}`
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const bend = 0.11
    return `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}`
  }

  const selectedNode = selectedId ? graph.nodes.find((n) => n.id === selectedId) : null

  return (
    <div ref={wrapRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      <svg
        className="graph-canvas h-full w-full"
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        role="application"
        aria-label="可交互的记忆地图。拖动空白处平移，滚轮缩放，点击节点查看关系。"
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* faint orbit guides */}
          {size.w > 0 && (
            <g fill="none" stroke="rgba(29,35,121,0.1)">
              <ellipse cx={size.w / 2} cy={size.h / 2} rx={size.w * 0.37} ry={size.h * 0.34} />
              <ellipse cx={size.w / 2} cy={size.h / 2} rx={size.w * 0.245} ry={size.h * 0.245} />
              <ellipse cx={size.w / 2} cy={size.h / 2} rx={size.w * 0.115} ry={size.h * 0.125} />
            </g>
          )}

          {graph.edges.map((edge) => {
            const a = positions.get(edge.source)
            const b = positions.get(edge.target)
            if (!a || !b) return null
            const dim =
              neighborIds && !(neighborIds.has(edge.source) && neighborIds.has(edge.target))
            const active =
              selectedId !== null && (edge.source === selectedId || edge.target === selectedId)
            const stroke =
              edge.kind === 'film-film'
                ? 'rgba(29,35,121,0.3)'
                : edge.kind === 'film-theme'
                  ? 'rgba(29,35,121,0.24)'
                  : 'rgba(90,95,133,0.26)'
            return (
              <path
                key={edge.id}
                d={edgePath(edge, a, b)}
                fill="none"
                stroke={active ? 'rgba(29,35,121,0.95)' : stroke}
                strokeWidth={active ? 1.4 : edge.kind === 'film-film' ? 1 : 0.7}
                strokeDasharray={edge.kind === 'film-mood' ? '2 5' : undefined}
                opacity={dim ? 0.07 : 1}
              />
            )
          })}

          {graph.nodes.map((node) => {
            const point = positions.get(node.id)
            if (!point) return null
            const dim = neighborIds ? !neighborIds.has(node.id) : false
            const isSelected = node.id === selectedId
            const isHovered = node.id === hovered
            const film = node.filmId ? filmMap.get(node.filmId) : undefined
            const below = point.y <= size.h / 2
            const labelY =
              node.kind === 'film'
                ? below
                  ? 44
                  : -34
                : below
                  ? radiusOf(node) + 14
                  : -radiusOf(node) - 10
            const labelSize = node.kind === 'film' ? (size.w < 640 ? 10.5 : 11.5) : node.kind === 'theme' ? 11.5 : 11
            const showLabel =
              isSelected ||
              isHovered ||
              view.k > 1.35 ||
              (size.w >= 640 &&
                (node.kind === 'film' || (node.kind === 'theme' && labelledThemes.has(node.id))))

            return (
              <g
                key={node.id}
                data-node="true"
                transform={`translate(${point.x} ${point.y})`}
                opacity={dim ? 0.16 : 1}
                className="graph-node"
                tabIndex={0}
                role="button"
                aria-label={`${{ film: '电影', theme: '主题', mood: '情绪' }[node.kind]}：${node.label}`}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  const world = toWorld(event.clientX, event.clientY)
                  dragRef.current = {
                    id: node.id,
                    ox: (dragged[node.id] ?? layout.get(node.id) ?? world).x - world.x,
                    oy: (dragged[node.id] ?? layout.get(node.id) ?? world).y - world.y,
                  }
                  movedRef.current = false
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId)
                  } catch {
                    /* synthetic pointers have no capture target */
                  }
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  if (!movedRef.current) onSelect(node)
                  dragRef.current = null
                  movedRef.current = false
                }}
                onClick={(event) => event.stopPropagation()}
                onPointerEnter={() => setHovered(node.id)}
                onPointerLeave={() => setHovered((current) => (current === node.id ? null : current))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(node)
                }}
              >
                <circle
                  r={node.kind === 'film' ? 36 : radiusOf(node) + 8}
                  fill="transparent"
                />

                {isSelected && (
                  <circle
                    r={radiusOf(node) + 12}
                    fill="none"
                    stroke="rgba(29,35,121,0.4)"
                    strokeDasharray="2 5"
                    className="animate-breathe"
                  />
                )}

                {node.kind === 'film' ? (
                  <>
                    <clipPath id={`clip-${node.id.replace(/[^a-zA-Z0-9-]/g, '')}`}>
                      <rect x={-23} y={-30} width={46} height={60} rx={2} />
                    </clipPath>
                    <g clipPath={`url(#clip-${node.id.replace(/[^a-zA-Z0-9-]/g, '')})`}>
                      <rect x={-23} y={-30} width={46} height={60} fill="#fdf6e2" />
                      {film && (
                        <image
                          href={frameSrc(film, 'w342')}
                          x={-40}
                          y={-42}
                          width={80}
                          height={84}
                          preserveAspectRatio="xMidYMid slice"
                          opacity={isSelected || isHovered ? 1 : 0.9}
                        />
                      )}
                      <rect x={-23} y={-30} width={46} height={60} fill="#161c66" opacity={0.08} />
                    </g>
                    <rect
                      x={-23}
                      y={-30}
                      width={46}
                      height={60}
                      rx={2}
                      fill="none"
                      stroke={isSelected ? '#1d2379' : 'rgba(29,35,121,0.38)'}
                      strokeWidth={isSelected ? 1.6 : 0.9}
                    />
                    {isSelected && (
                      <rect
                        x={-26.5}
                        y={-33.5}
                        width={53}
                        height={67}
                        rx={3}
                        fill="none"
                        stroke="rgba(29,35,121,0.32)"
                        strokeWidth={0.7}
                      />
                    )}
                  </>
                ) : node.kind === 'theme' ? (
                  <>
                    <rect
                      x={-radiusOf(node)}
                      y={-radiusOf(node)}
                      width={radiusOf(node) * 2}
                      height={radiusOf(node) * 2}
                      transform="rotate(45)"
                      fill="rgba(29,35,121,0.08)"
                      stroke={isSelected ? 'rgba(29,35,121,0.95)' : 'rgba(29,35,121,0.55)'}
                      strokeWidth={isSelected ? 1.5 : 0.9}
                    />
                    <circle r={1.5} fill="#1d2379" />
                  </>
                ) : (
                  <circle
                    r={radiusOf(node)}
                    fill="rgba(90,95,133,0.12)"
                    stroke={isSelected ? 'rgba(29,35,121,0.95)' : 'rgba(90,95,133,0.55)'}
                    strokeWidth={isSelected ? 1.4 : 0.9}
                  />
                )}

                {showLabel && (
                  <text
                    y={labelY}
                    textAnchor="middle"
                    fill={isSelected ? '#1d2379' : 'rgba(22,28,102,0.82)'}
                    stroke="#f4ead2"
                    strokeWidth={4}
                    strokeOpacity={0.9}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    style={{
                      fontSize: labelSize,
                      letterSpacing: node.kind === 'film' ? '0.02em' : '0.04em',
                      textTransform: node.kind === 'film' ? 'none' : 'uppercase',
                      fontFamily:
                        node.kind === 'film'
                          ? 'Instrument Serif, Georgia, serif'
                          : "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
                    }}
                  >
                    {truncate(node.label, node.kind === 'film' ? (size.w < 640 ? 14 : 26) : 15)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
        <p className="hidden font-mono text-[11.5px] uppercase tracking-[0.13em] text-taupe/75 sm:block">
          拖动平移 · 滚轮缩放 · 拖动节点 · 点击查看关系
        </p>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-ink/15 bg-paper-sheet/90 p-1 text-ink shadow-card backdrop-blur">
          <button type="button" onClick={() => zoomBy(1.22)} className="icon-btn h-8 w-8 border-0" aria-label="放大">
            <Plus size={13} />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.22)} className="icon-btn h-8 w-8 border-0" aria-label="缩小">
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              setView({ x: 0, y: 0, k: 1 })
              setDragged({})
            }}
            className="icon-btn h-8 w-8 border-0"
            aria-label="重置视图"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {selectedNode && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[220px] rounded-[8px] border border-ink/15 bg-paper-sheet/90 px-3 py-2 shadow-card backdrop-blur">
          <p className="micro-sm text-ink/50">
            {selectedNode.kind === 'film' ? '电影' : selectedNode.kind === 'theme' ? '主题' : '情绪'}
          </p>
          <p className="mt-1 font-display text-lg leading-tight text-ink">{selectedNode.label}</p>
        </div>
      )}
    </div>
  )
}

export const GraphLegend = ({ showThemes, showMoods }: { showThemes: boolean; showMoods: boolean }) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] tracking-[0.03em] text-taupe">
    <span className="flex items-center gap-2">
      <span className="inline-block h-3 w-2.5 rounded-[1px] border border-ocean/70" /> 电影
    </span>
    {showThemes && (
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rotate-45 border border-ocean/60 bg-ocean/15" /> 主题
      </span>
    )}
    {showMoods && (
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full border border-taupe/60" /> 情绪
      </span>
    )}
    <span className="flex items-center gap-2">
      <span className="inline-block h-px w-4 bg-ink/35" /> 共同主题
    </span>
  </div>
)
