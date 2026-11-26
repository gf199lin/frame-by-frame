import { useEffect, useRef, useState } from 'react'
import type { DimensionKey, TasteSnapshot } from '@/types'
import { DIMENSIONS } from '@/data/taxonomy'
import { cn } from '@/lib/format'

const SHORT: Record<DimensionKey, string> = {
  narrative: '叙事',
  emotion: '情绪',
  thematic: '主题',
  visual: '视觉',
  character: '人物',
  ending: '结局',
}

const LEAN: Record<DimensionKey, [string, string]> = {
  narrative: ['慢热', '推进'],
  emotion: ['克制', '浓烈'],
  thematic: ['向内', '向外'],
  visual: ['自然', '风格化'],
  character: ['人物驱动', '群像'],
  ending: ['未解', '希望'],
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
  const gridColor = tone === 'light' ? 'rgba(29,35,121,0.14)' : 'rgba(248,242,227,0.12)'
  const axisColor = tone === 'light' ? 'rgba(29,35,121,0.24)' : 'rgba(248,242,227,0.15)'
  const labelColor = tone === 'light' ? 'rgba(22,28,102,0.78)' : 'rgba(248,242,227,0.62)'
  const subLabelColor = tone === 'light' ? 'rgba(90,95,133,0.85)' : 'rgba(195,201,230,0.55)'
  const pointColor = tone === 'light' ? '#161c66' : '#FDF6E2'
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
        aria-label="观影品味雷达图——六个维度在各自轴线上的位置"
      >
        <defs>
          <radialGradient id="radar-fill">
            <stop offset="0%" stopColor="#161c66" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#161c66" stopOpacity="0.045" />
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
              stroke={activeKey === dim.key ? 'rgba(29,35,121,0.7)' : axisColor}
              strokeWidth={activeKey === dim.key ? 1.2 : 0.6}
            />
          )
        })}

        <polygon points={polygon} fill="url(#radar-fill)" stroke="rgba(29,35,121,0.92)" strokeWidth="1.2" />
        <polygon points={polygon} fill="none" stroke="rgba(92,99,144,0.25)" strokeWidth="4" />

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
            const lean = value < 0.44 ? LEAN[dim.key][0] : value > 0.56 ? LEAN[dim.key][1] : '平衡'
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
                  fill={activeKey === dim.key ? '#161c66' : labelColor}
                  style={{ letterSpacing: '0.04em', fontSize: size * 0.028, fontWeight: 500 }}
                >
                  {SHORT[dim.key]}
                </text>
                <text
                  x={x}
                  y={y + size * 0.033}
                  textAnchor={anchor}
                  fill={activeKey === dim.key ? 'rgba(29,35,121,0.9)' : subLabelColor}
                  style={{ fontSize: size * 0.025, fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" }}
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
        <div className="absolute left-0 right-0 top-1/2 h-px bg-ink/20" />
        {[0.25, 0.5, 0.75].map((tick) => (
          <div
            key={tick}
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/15"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
        {filmPct !== null && (
          <div
            className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 border border-ink/45 bg-transparent"
            style={{ left: `${filmPct}%` }}
            title="这部电影"
          />
        )}
        <div
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 bg-ink shadow-[0_0_10px_rgba(29,35,121,0.25)]"
          style={{ left: `${pct}%` }}
          title="你的片库"
        />
      </div>
      {showLabels && (
        <div className="mt-1 flex justify-between gap-2 text-[12px] tracking-[0.04em] text-taupe">
          <span>{low}</span>
          <span className="text-right">{high}</span>
        </div>
      )}
    </div>
  )
}


/**
 * Two-state radar used after a new record: the previous shape is a dashed
 * ghost, the new shape is drawn in paper. Small numeric shifts read as a visible change.
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
      aria-label="加入这部电影前后的观影品味对比"
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
          stroke="rgba(248,242,227,0.1)"
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
            stroke="rgba(248,242,227,0.12)"
            strokeWidth="0.6"
          />
        )
      })}
      <polygon points={beforePoints} fill="none" stroke="rgba(248,242,227,0.4)" strokeWidth="0.9" strokeDasharray="2 4" />
      <polygon points={afterPoints} fill="rgba(195,201,230,0.16)" stroke="rgba(248,242,227,0.92)" strokeWidth="1.1" />
      {DIMENSIONS.map((dim, i) => {
        const [x, y] = point(after[dim.key], i)
        return <circle key={dim.key} cx={x} cy={y} r={2} fill="#FDF6E2" />
      })}
    </svg>
  )
}
