import { useEffect, useState } from 'react'
import type { Film } from '@/types'
import { cn } from '@/lib/format'
import { imageSrcSet, imageUrl, resolveFilmArtwork } from '@/lib/artwork'

/**
 * A real film frame.
 *
 * Priority: TMDB backdrop (or a verified still) → the film's official poster as
 * a blurred atmospheric fallback → a designed "image unavailable" panel.
 * Generated imagery is never used to fill the slot.
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
  const artwork = resolveFilmArtwork(film)
  const scene = ratio === 'portrait' ? undefined : artwork?.backdrop ?? artwork?.stills?.[0]
  const posterFallback = !scene ? artwork?.poster : undefined
  const image = scene ?? posterFallback
  const src = image ? imageUrl(image, ratio === 'portrait' ? 'w500' : 'w1280') : ''
  const srcSet = image ? imageSrcSet(image) : undefined
  const isPosterFallback = !scene && Boolean(posterFallback)

  useEffect(() => {
    setFailed(false)
  }, [src])

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
        tone === 'paper' ? 'bg-[#C7BBA8]' : 'bg-[#211e19]',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1400px"
          alt={
            isPosterFallback
              ? `${film.title} (${film.year}) official poster artwork`
              : `${film.title} (${film.year}) official still`
          }
          width={image?.width ?? 1280}
          height={image?.height ?? 720}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover',
            isPosterFallback && 'scale-110 blur-[18px] brightness-[0.62] saturate-[0.9]',
          )}
          style={{
            objectPosition:
              position ??
              (isPosterFallback ? '50% 32%' : ratio === 'portrait' ? '50% 50%' : '50% 45%'),
          }}
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-end p-5',
            tone === 'paper' ? 'bg-[#C7BBA8] text-ink' : 'bg-[#1b1814] text-paper',
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-[6%] border',
              tone === 'paper' ? 'border-ink/15' : 'border-white/12',
            )}
            aria-hidden="true"
          />
          <div className="relative">
            <p
              className={cn(
                'font-mono text-[8px] uppercase tracking-[0.22em]',
                tone === 'paper' ? 'text-ink/45' : 'text-paper/40',
              )}
            >
              Image unavailable
            </p>
            <p
              className={cn(
                'mt-2 font-display text-[clamp(1rem,2vw,1.5rem)] leading-tight',
                tone === 'paper' ? 'text-ink/75' : 'text-paper/75',
              )}
            >
              {film.title}
            </p>
          </div>
        </div>
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
