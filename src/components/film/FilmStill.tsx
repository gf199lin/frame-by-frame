import { useState } from 'react'
import type { Film } from '@/types'
import { cn } from '@/lib/format'
import { frameSrc, portraitPosition } from '@/lib/media'

/**
 * A film "memory frame".
 *
 * These are the photographs the archive is built around: wide, quiet,
 * available-light stills that stand in for the film without pretending to be
 * its official poster. Everything is local, so nothing breaks offline.
 */
export const FilmStill = ({
  film,
  className,
  ratio = 'wide',
  tone = 'dark',
  position,
  label,
  eager = false,
  children,
}: {
  film: Film
  className?: string
  ratio?: 'wide' | 'photo' | 'portrait' | 'free'
  tone?: 'dark' | 'paper'
  position?: string
  label?: string
  eager?: boolean
  children?: React.ReactNode
}) => {
  const [failed, setFailed] = useState(false)
  const ratioClass =
    ratio === 'portrait'
      ? 'aspect-[2/3]'
      : ratio === 'photo'
        ? 'aspect-[3/2]'
        : ratio === 'wide'
          ? 'aspect-[16/9]'
          : ''

  return (
    <div
      className={cn(
        'still group/still relative overflow-hidden',
        ratioClass,
        tone === 'paper' ? 'bg-[#d9d4ca]' : 'bg-[#141414]',
        className,
      )}
    >
      {!failed ? (
        <img
          src={frameSrc(film.id)}
          alt={`A memory frame from ${film.title}`}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
          className="film-tone h-full w-full object-cover"
          style={{ objectPosition: position ?? portraitPosition(film.id) }}
        />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: `radial-gradient(120% 90% at 60% 20%, ${film.palette.soft}, ${film.palette.deep} 68%, #070708)`,
          }}
        />
      )}
      <span className="pointer-events-none absolute inset-0 still-edge" aria-hidden="true" />
      {label && (
        <span className="pointer-events-none absolute bottom-3 left-3 bg-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-paper/80 backdrop-blur-sm">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}
