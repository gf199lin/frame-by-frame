import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/format'

export const SectionLabel = ({
  index,
  children,
  className,
}: {
  index?: string
  children: ReactNode
  className?: string
}) => (
  <div className={cn('flex items-center gap-3 text-paper-muted', className)}>
    {index && <span className="font-mono text-[10px] tracking-[0.2em] text-brass/80">{index}</span>}
    <span className="micro">{children}</span>
    <span className="h-px flex-1 bg-white/10" />
  </div>
)

export const EmptyState = ({
  eyebrow,
  title,
  description,
  action,
  className,
  tone = 'dark',
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  tone?: 'dark' | 'light'
}) => {
  const light = tone === 'light'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border border-dashed px-8 py-20 text-center',
        light ? 'border-ink/20' : 'border-white/12',
        className,
      )}
    >
      {eyebrow && <p className={cn('micro mb-4', light ? 'text-brass' : 'text-brass/80')}>{eyebrow}</p>}
      <h3 className={cn('font-display text-3xl', light ? 'text-ink' : 'text-paper')}>{title}</h3>
      {description && (
        <p className={cn('mt-3 max-w-md text-sm leading-relaxed', light ? 'text-ink/60' : 'text-paper-dim')}>
          {description}
        </p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}

export const TextLink = ({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) => (
  <Link
    to={to}
    className={cn(
      'link-underline micro text-paper-dim transition-colors hover:text-paper',
      className,
    )}
  >
    {children}
    <ArrowUpRight size={12} strokeWidth={1.5} />
  </Link>
)

export const Spinner = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-block h-4 w-4 animate-spin rounded-full border border-paper/25 border-t-paper/80',
      className,
    )}
    aria-hidden="true"
  />
)
