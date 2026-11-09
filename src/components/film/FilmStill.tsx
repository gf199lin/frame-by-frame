import { useEffect, useState } from 'react'
import type { Film } from '@/types'
import { cn } from '@/lib/format'
import { imageSrcSet, imageUrl, resolveFilmArtwork } from '@/lib/artwork'

/**
 * A real film frame.
 *
 * Priority: TMDB backdrop (or a verified still) → the film's official poster as
 * a fallback if the backdrop cannot load → a designed "image unavailable"
 * panel. Generated imagery is never used to fill the slot.
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
  const [posterFallback, setPosterFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const artwork = resolveFilmArtwork(film)
  const scene = artwork?.backdrop ?? artwork?.stills?.[0]
  const poster = artwork?.poster
  const usePoster = !scene || posterFallback
  const image = usePoster ? poster : scene
  const src = image ? imageUrl(image, usePoster ? 'w500' : 'w1280') : ''
  const srcSet = image ? imageSrcSet(image) : undefined
  const posterLayer = scene && poster ? imageUrl(poster, 'w500') : ''
  const isPosterFallback = usePoster && Boolean(poster)
  /** A poster cropped to a wide frame needs blur; in a portrait slot it fits. */
  const blurPoster = isPosterFallback && ratio !== 'portrait'

  useEffect(() => {
    setPosterFallback(false)
    setFailed(false)
  }, [film.id])

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
        tone === 'paper' ? 'bg-[#E6D8B9]' : 'bg-[#1a2170]',
        className,
      )}
    >
      {posterLayer && !failed && (
        <img
          src={posterLayer}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn(
            'absolute inset-0 z-0 h-full w-full object-cover',
            ratio === 'portrait' ? 'opacity-100' : 'scale-110 opacity-90 blur-[16px] brightness-[0.68] saturate-[0.9]',
          )}
        />
      )}
      {src && !failed ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={
            usePoster
              ? '(max-width: 640px) 60vw, (max-width: 1280px) 40vw, 500px'
              : '(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1400px'
          }
          alt={
            isPosterFallback
              ? `${film.title}（${film.year}）官方海报`
              : `${film.title}（${film.year}）官方剧照`
          }
          width={image?.width ?? 1280}
          height={image?.height ?? 720}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (!posterFallback && scene && poster) {
              setPosterFallback(true)
              return
            }
            setFailed(true)
          }}
          className={cn(
            'relative z-10 h-full w-full object-cover',
            blurPoster && 'scale-110 blur-[18px] brightness-[0.62] saturate-[0.9]',
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
            tone === 'paper' ? 'bg-[#E6D8B9] text-ink' : 'bg-[#121750] text-paper',
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-[6%] border',
              tone === 'paper' ? 'border-ink/15' : 'border-white/10',
            )}
            aria-hidden="true"
          />
          <div className="relative">
            <p
              className={cn(
                'font-mono text-[11px] uppercase tracking-[0.18em]',
                tone === 'paper' ? 'text-ink/60' : 'text-paper/40',
              )}
            >
              图片暂不可用
            </p>
            <p
              className={cn(
                'mt-2 font-display text-[clamp(1rem,2vw,1.5rem)] leading-tight',
                tone === 'paper' ? 'text-ink/80' : 'text-paper/75',
              )}
            >
              {film.title}
            </p>
          </div>
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 z-20 still-edge" aria-hidden="true" />
      {label && (
        <span className="pointer-events-none absolute bottom-3 left-3 z-20 bg-ink/70 px-2 py-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-paper/80 backdrop-blur-sm">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}
