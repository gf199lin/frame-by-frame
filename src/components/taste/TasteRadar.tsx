import { useEffect, useRef, useState } from 'react'
import type { DimensionKey, TasteSnapshot } from '@/types'
import { DIMENSIONS } from '@/data/taxonomy'
import { cn } from '@/lib/format'

const SHORT: Record<DimensionKey, string> = {
  narrative: 'Narrative',
  emotion: 'Emotion',
  thematic: 'Theme',
  visual: 'Visual',
  character: 'Character',
  ending: 'Ending',
}

const LEAN: Record<DimensionKey, [string, string]> = {
  narrative: ['slow-burn', 'propulsive'],
  emotion: ['restrained', 'cathartic'],
  thematic: ['inward', 'outward'],
  visual: ['naturalistic', 'composed'],
  character: ['character-led', 'ensemble'],
  ending: ['unresolved', 'hopeful'],
}

const useAnimatedValues = (target: number[], duration = 850) => {
  const [values, setValues] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)
  const key = target.join('|')

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from.map((v, i) => v + ((target[i] ?? v) - v) * eased)
      setValues(next)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
    // `key` captures the numeric target without re-triggering on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration])

  return values
}

export const TasteRadar = ({
  snapshot,
  size = 420,
  onSelect,
  activeKey,
  mini = false,
  className,
  tone = 'dark',
}: {
  snapshot: TasteSnapshot
  size?: number
  onSelect?: (key: DimensionKey) => void
  activeKey?: DimensionKey | null
  mini?: boolean
  className?: string
  tone?: 'dark' | 'light'
}) => {
  const values = snapshot.dimensionScores.map((d) => d.value)
  const gridColor = tone === 'light' ? 'rgba(23,20,18,0.14)' : 'rgba(242,240,235,0.12)'
  const axisColor = tone === 'light' ? 'rgba(23,20,18,0.18)' : 'rgba(242,240,235,0.15)'
  const labelColor = tone === 'light' ? 'rgba(23,20,18,0.62)' : 'rgba(242,240,235,0.62)'
  const subLabelColor = tone === 'light' ? 'rgba(23,20,18,0.42)' : 'rgba(201,197,189,0.55)'
  const pointColor = tone === 'light' ? '#B02F2A' : '#E2625B'
  const animated = useAnimatedValues(values, mini ? 500 : 900)
  const center = size / 2
  const radius = size * (mini ? 0.33 : 0.31)
  const ringCount = 4

  const point = (value: number, index: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6
    const r = radius * (0.1 + 0.9 * value)
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const
  }

  const polygon = animated
    .map((value, i) => point(value, i).join(','))
    .join(' ')

  return (
    <div className={cn('relative w-full', className)} style={{ maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Taste profile radar chart — six dimensions, positions on their axes"
      >
        <defs>
          <radialGradient id="radar-fill">
            <stop offset="0%" stopColor="#C83B35" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C83B35" stopOpacity="0.045" />
          </radialGradient>
        </defs>

        {Array.from({ length: ringCount }).map((_, ring) => {
          const r = (radius * (ring + 1)) / ringCount
          const pts = Array.from({ length: 6 })
            .map((__, i) => {
              const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6
              return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
            })
            .join(' ')
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke={gridColor}
              strokeWidth={ring === ringCount - 1 ? 1 : 0.6}
            />
          )
        })}

        {DIMENSIONS.map((dim, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6
          const outer = [
            center + Math.cos(angle) * radius,
            center + Math.sin(angle) * radius,
          ] as const
          return (
            <line
              key={dim.key}
              x1={center}
              y1={center}
              x2={outer[0]}
              y2={outer[1]}
              stroke={activeKey === dim.key ? 'rgba(200,59,53,0.7)' : axisColor}
              strokeWidth={activeKey === dim.key ? 1.2 : 0.6}
            />
          )
        })}

        <polygon points={polygon} fill="url(#radar-fill)" stroke="rgba(200,59,53,0.92)" strokeWidth="1.2" />
        <polygon points={polygon} fill="none" stroke="rgba(226,98,91,0.22)" strokeWidth="4" />

        {animated.map((value, i) => {
          const [x, y] = point(value, i)
          return <circle key={i} cx={x} cy={y} r={mini ? 1.8 : 2.6} fill={pointColor} />
        })}

        <circle cx={center} cy={center} r={1.5} fill={gridColor} />

        {!mini &&
          DIMENSIONS.map((dim, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6
            const labelR = radius + size * 0.085
            const x = center + Math.cos(angle) * labelR
            const y = center + Math.sin(angle) * labelR
            const anchor =
              Math.abs(Math.cos(angle)) < 0.25 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
            const value = snapshot.dimensionScores[i]?.value ?? 0.5
            const lean = value < 0.44 ? LEAN[dim.key][0] : value > 0.56 ? LEAN[dim.key][1] : 'balanced'
            return (
              <g
                key={dim.key}
                className="cursor-pointer"
                onClick={() => onSelect?.(dim.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSelect?.(dim.key)
                }}
              >
                <text
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  className="micro-sm"
                  fill={activeKey === dim.key ? '#C83B35' : labelColor}
                  style={{ letterSpacing: '0.16em', fontSize: size * 0.022 }}
                >
                  {SHORT[dim.key]}
                </text>
                <text
                  x={x}
                  y={y + size * 0.033}
                  textAnchor={anchor}
                  fill={activeKey === dim.key ? 'rgba(200,59,53,0.9)' : subLabelColor}
                  style={{ fontSize: size * 0.022, fontStyle: 'italic', fontFamily: 'Instrument Serif, Georgia, serif' }}
                >
                  {lean}
                </text>
              </g>
            )
          })}
      </svg>
    </div>
  )
}

export const PoleAxis = ({
  value,
  filmValue,
  low,
  high,
  className,
  showLabels = true,
}: {
  value: number
  filmValue?: number
  low: string
  high: string
  className?: string
  showLabels?: boolean
}) => {
  const pct = Math.min(98, Math.max(2, value * 100))
  const filmPct = filmValue === undefined ? null : Math.min(98, Math.max(2, filmValue * 100))
  return (
    <div className={className}>
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
        {[0.25, 0.5, 0.75].map((tick) => (
          <div
            key={tick}
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/12"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
        {filmPct !== null && (
          <div
            className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 border border-paper/50 bg-transparent"
            style={{ left: `${filmPct}%` }}
            title="This film"
          />
        )}
        <div
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 bg-brass shadow-[0_0_10px_rgba(200,59,53,0.55)]"
          style={{ left: `${pct}%` }}
          title="Your archive"
        />
      </div>
      {showLabels && (
        <div className="mt-1 flex justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-paper-muted">
          <span>{low}</span>
          <span className="text-right">{high}</span>
        </div>
      )}
    </div>
  )
}


/**
 * Two-state radar used after a new record: the previous shape is a dashed
 * ghost, the new shape is cinema red. Small numeric shifts read as a visible change.
 */
export const ShiftRadar = ({
  before,
  after,
  size = 160,
}: {
  before: Record<DimensionKey, number>
  after: Record<DimensionKey, number>
  size?: number
}) => {
  const center = size / 2
  const radius = size * 0.36
  const point = (value: number, index: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6
    const r = radius * (0.1 + 0.9 * value)
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const
  }
  const polygon = (values: number[]) => values.map((value, i) => point(value, i).join(',')).join(' ')
  const beforePoints = polygon(DIMENSIONS.map((d) => before[d.key]))
  const afterPoints = polygon(DIMENSIONS.map((d) => after[d.key]))

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full shrink-0"
      style={{ maxWidth: size }}
      role="img"
      aria-label="Taste profile before and after this film"
    >
      {[0.33, 0.66, 1].map((tick) => (
        <polygon
          key={tick}
          points={Array.from({ length: 6 })
            .map((_, i) => {
              const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6
              const r = radius * tick
              return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
            })
            .join(' ')}
          fill="none"
          stroke="rgba(242,240,235,0.1)"
          strokeWidth="0.6"
        />
      ))}
      {DIMENSIONS.map((dim, i) => {
        const [x, y] = point(1, i)
        return (
          <line
            key={dim.key}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(242,240,235,0.12)"
            strokeWidth="0.6"
          />
        )
      })}
      <polygon points={beforePoints} fill="none" stroke="rgba(242,240,235,0.4)" strokeWidth="0.9" strokeDasharray="2 4" />
      <polygon points={afterPoints} fill="rgba(200,59,53,0.16)" stroke="rgba(226,98,91,0.92)" strokeWidth="1.1" />
      {DIMENSIONS.map((dim, i) => {
        const [x, y] = point(after[dim.key], i)
        return <circle key={dim.key} cx={x} cy={y} r={2} fill="#E2625B" />
      })}
    </svg>
  )
}
