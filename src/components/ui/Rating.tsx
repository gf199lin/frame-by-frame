import { cn } from '@/lib/format'

type StarProps = {
  fill: number
  size: number
  className?: string
  emptyColor?: string
}

const Star = ({ fill, size, className, emptyColor = 'rgba(242,240,235,0.2)' }: StarProps) => {
  const id = `star-${Math.round(fill * 100)}-${size}-${(emptyColor ?? '').replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="currentColor" />
          <stop offset={`${fill * 100}%`} stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        d="M10 1.6l2.47 5.1 5.6.77-4.08 3.9.99 5.55L10 14.24l-4.98 2.68.99-5.55L1.93 7.47l5.6-.77L10 1.6z"
        fill={`url(#${id})`}
      />
    </svg>
  )
}

export const Rating = ({
  value,
  size = 13,
  showValue = false,
  className,
  tone = 'dark',
}: {
  value: number
  size?: number
  showValue?: boolean
  className?: string
  tone?: 'dark' | 'light'
}) => {
  const light = tone === 'light'
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={`${value} out of 5`}>
      <span className={cn('inline-flex items-center gap-[2px]', light ? 'text-ink' : 'text-paper')}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            fill={Math.max(0, Math.min(1, value - i))}
            size={size}
            emptyColor={light ? 'rgba(23,20,18,0.2)' : 'rgba(242,240,235,0.2)'}
          />
        ))}
      </span>
      {showValue && (
        <span className={cn('ml-1 font-mono text-[11px] tabular-nums', light ? 'text-ink/55' : 'text-paper-dim')}>
          {value.toFixed(1)}
        </span>
      )}
    </span>
  )
}

export const RatingInput = ({
  value,
  onChange,
  size = 26,
}: {
  value: number
  onChange: (value: number) => void
  size?: number
}) => {
  return (
    <div className="flex items-center gap-3" role="radiogroup" aria-label="Your rating">
      <div className="flex items-center gap-[3px] text-paper">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <Star fill={Math.max(0, Math.min(1, value - i))} size={size} />
            <button
              type="button"
              aria-label={`Rate ${i + 0.5} out of 5`}
              onClick={() => onChange(i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
            />
            <button
              type="button"
              aria-label={`Rate ${i + 1} out of 5`}
              onClick={() => onChange(i + 1)}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
            />
          </div>
        ))}
      </div>
      <span className="font-mono text-xs tabular-nums text-paper-dim">
        {value > 0 ? value.toFixed(1) : '—'} <span className="text-paper-muted">/ 5</span>
      </span>
    </div>
  )
}
