import { useState, type CSSProperties } from 'react'
import type { Film } from '@/types'
import { cn } from '@/lib/format'
import { imageSrcSet, imageUrl, resolveFilmArtwork } from '@/lib/artwork'
import { zhCountry, zhGenre } from '@/data/taxonomy'
import { directorOf } from '@/data/filmCopy'

/**
 * Film poster.
 *
 * Only real artwork is rendered: a user-supplied URL, a verified TMDB poster,
 * or a verified local copy of the official release poster. If none is
 * available — or the file fails to load — a designed placeholder is shown.
 * Generated artwork is never used as a stand-in for a real film.
 */
const PosterPlaceholder = ({ film }: { film: Film }) => {
  const artwork = resolveFilmArtwork(film)
  return (
    <div className="absolute inset-0 flex flex-col justify-between bg-[#211e19] p-[7%]">
      <div
        className="pointer-events-none absolute inset-[5%] border border-white/10"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-2">
        <span className="poster-meta tracking-[0.12em] text-paper/35">暂无海报</span>
        <span className="poster-meta text-right uppercase tracking-[0.16em] text-paper/25">
          {artwork?.tmdbId ? `TMDB ${artwork.tmdbId}` : 'FbF'}
        </span>
      </div>

      <div className="relative">
        <p className="poster-meta mb-2 uppercase tracking-[0.18em] text-paper/50">
          暂无官方图片
        </p>
        <h3 className="poster-title font-display text-paper/90">{film.title}</h3>
        <p className="poster-meta mt-2 uppercase tracking-[0.16em] text-paper/35">
          {film.year}
          {film.director && film.director !== 'Unknown director' ? ` · ${film.director}` : ''}
        </p>
      </div>
    </div>
  )
}

export const FilmPoster = ({
  film,
  className,
  showTitle = true,
  eager = false,
  position,
}: {
  film: Film
  className?: string
  showTitle?: boolean
  eager?: boolean
  position?: string
}) => {
  const [failed, setFailed] = useState(false)
  const artwork = resolveFilmArtwork(film)
  const poster = artwork?.poster
  const source = film.posterUrl ?? (poster ? imageUrl(poster, 'w500') : '')
  const srcSet = film.posterUrl ? undefined : poster ? imageSrcSet(poster) : undefined

  const style = {
    '--film-accent': film.palette.accent,
    backgroundColor: film.palette.deep,
  } as CSSProperties

  return (
    <div className={cn('poster-frame relative h-full w-full', className)} style={style}>
      {source && !failed ? (
        <img
          src={source}
          srcSet={srcSet}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
          alt={`${film.title}（${film.year}）官方海报`}
          width={poster?.width ?? 500}
          height={poster?.height ?? 750}
          className="film-tone absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position ?? '50% 50%' }}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <PosterPlaceholder film={film} />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,6,7,0.42) 0%, rgba(6,6,7,0) 22%, rgba(6,6,7,0) 46%, rgba(6,6,7,0.74) 82%, rgba(6,6,7,0.92) 100%)',
        }}
      />
      <div className="poster-grain pointer-events-none absolute inset-0" />

      {showTitle && (
        <>
          <div className="absolute left-[6%] right-[6%] top-[5%] flex items-start justify-between gap-3">
            <span className="poster-meta uppercase text-paper/55">
              {film.year} · {zhCountry(film.country)}
            </span>
            <span className="poster-genre poster-meta text-right uppercase text-paper/40">
              {zhGenre(film.genres[0])}
            </span>
          </div>

          <div className="absolute bottom-[5.5%] left-[6%] right-[6%]">
            {film.director && film.director !== 'Unknown director' && (
              <p className="poster-meta mb-2 tracking-[0.06em] text-paper/45">{directorOf(film)}</p>
            )}
            <h3 className="poster-title font-display text-paper">{film.title}</h3>
            <div className="mt-2 flex items-end justify-between gap-3 border-t border-white/20 pt-2">
              {film.titleZh && film.titleZh !== film.title && (
                <p className="poster-title-zh text-paper/60">{film.titleZh}</p>
              )}
              <p className="poster-meta whitespace-nowrap text-right uppercase text-paper/40">
                {film.runtime} 分钟
              </p>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
