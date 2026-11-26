import { FILMS } from '@/data/films'
import { FILM_ARTWORK } from '@/data/filmArtwork'
import generatedJson from '@/data/filmArtwork.generated.json'
import type { Film, FilmArtwork, FilmImage } from '@/types'

/**
 * Single entry point for every film image in the app.
 *
 * Rules:
 *  - Real artwork only: a verified TMDB path or a verified local file.
 *  - Failures render a designed placeholder; they never fall back to
 *    generated or random imagery.
 *  - Artwork is matched by TMDB id first, then by exact title + year. User
 *    records are never mutated while resolving.
 */

const BASE = import.meta.env.BASE_URL || '/'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

/** TMDB accepts any of these size prefixes for a real file path. */
export type TmdbSize = 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original'

export const tmdbImage = (path: string, size: TmdbSize = 'w500') =>
  `${TMDB_IMAGE_BASE}/${size}${path}`

const localUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url
  return `${BASE}${url.replace(/^\/+/, '')}`
}

/** Resolve one image to a URL. Local files respect the GitHub Pages base. */
export const imageUrl = (image: FilmImage, size: TmdbSize = 'w500') => {
  if (image.provider === 'tmdb' && image.path) return tmdbImage(image.path, size)
  if (image.url) return localUrl(image.url)
  return ''
}

/** Responsive candidates for TMDB files; local verified files are single-size. */
export const imageSrcSet = (image: FilmImage) => {
  if (image.provider !== 'tmdb' || !image.path) return undefined
  return [
    `${tmdbImage(image.path, 'w342')} 342w`,
    `${tmdbImage(image.path, 'w500')} 500w`,
    `${tmdbImage(image.path, 'w780')} 780w`,
    `${tmdbImage(image.path, 'w1280')} 1280w`,
  ].join(', ')
}

const normalizeTitle = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

type TitleMatch = { filmId: string; artwork: FilmArtwork }

const titleYearIndex = new Map<string, TitleMatch>()
const titleIndex = new Map<string, TitleMatch[]>()

for (const film of FILMS) {
  const artwork = FILM_ARTWORK[film.id]
  if (!artwork) continue
  const key = `${normalizeTitle(film.title)}|${film.year}`
  titleYearIndex.set(key, { filmId: film.id, artwork })
  const list = titleIndex.get(normalizeTitle(film.title)) ?? []
  list.push({ filmId: film.id, artwork })
  titleIndex.set(normalizeTitle(film.title), list)
}

type GeneratedStill = { path: string; width: number; height: number; language?: string }
type GeneratedArtwork = {
  poster_path?: string
  backdrop_path?: string
  stills?: GeneratedStill[]
  verifiedAt?: string
}

/**
 * Optional output of `npm run artwork:sync`. When present it overrides the
 * curated registry, so a TMDB key refresh updates every page at once.
 */
const GENERATED = generatedJson as unknown as Record<string, GeneratedArtwork>
const tmdbSource = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}`

const generatedFor = (tmdbId?: number) => {
  if (!tmdbId) return undefined
  const entry = GENERATED[String(tmdbId)]
  if (!entry) return undefined
  if (!entry.poster_path && !entry.backdrop_path && !entry.stills?.length) return undefined
  return entry
}

const mergeGenerated = (
  artwork: FilmArtwork | undefined,
  film: Film,
): FilmArtwork | undefined => {
  const tmdbId = artwork?.tmdbId ?? film.tmdbId
  const generated = generatedFor(tmdbId)
  if (!generated || !tmdbId) return artwork

  const sourceUrl = tmdbSource(tmdbId)
  return {
    ...(artwork ?? {
      verifiedAt: generated.verifiedAt ?? 'unknown',
      matchSource: 'tmdb-api' as const,
    }),
    tmdbId,
    verifiedAt: generated.verifiedAt ?? artwork?.verifiedAt ?? 'unknown',
    matchSource: 'tmdb-api',
    poster: generated.poster_path
      ? {
          provider: 'tmdb',
          path: generated.poster_path,
          width: 500,
          height: 750,
          sourceUrl,
          credit: 'TMDB · official release artwork',
        }
      : artwork?.poster,
    backdrop: generated.backdrop_path
      ? {
          provider: 'tmdb',
          path: generated.backdrop_path,
          width: 1280,
          height: 720,
          sourceUrl,
          credit: 'TMDB · official release artwork',
        }
      : artwork?.backdrop,
    stills: generated.stills?.length
      ? generated.stills.map((still) => ({
          provider: 'tmdb' as const,
          path: still.path,
          width: still.width,
          height: still.height,
          language: still.language,
          sourceUrl,
          credit: 'TMDB · scene still',
        }))
      : artwork?.stills,
  }
}

const cache = new Map<string, FilmArtwork | undefined>()

/**
 * Resolve artwork for a film without touching the user's record.
 * Order: explicit record artwork → catalogue id → exact title + year →
 * unique title. Anything unresolved gets the designed placeholder.
 */
export const resolveFilmArtwork = (film: Film): FilmArtwork | undefined => {
  if (film.artwork) return mergeGenerated(film.artwork, film)

  const key = `${film.id}|${film.title}|${film.year}`
  if (cache.has(key)) return cache.get(key)

  let artwork: FilmArtwork | undefined = FILM_ARTWORK[film.id]

  if (!artwork) {
    artwork = titleYearIndex.get(`${normalizeTitle(film.title)}|${film.year}`)?.artwork
  }
  if (!artwork) {
    const candidates = titleIndex.get(normalizeTitle(film.title))
    if (candidates?.length === 1) artwork = candidates[0].artwork
  }

  const resolved = mergeGenerated(artwork, film)
  cache.set(key, resolved)
  return resolved
}

export const posterOf = (film: Film) => resolveFilmArtwork(film)?.poster
export const backdropOf = (film: Film) => resolveFilmArtwork(film)?.backdrop
export const stillsOf = (film: Film) => resolveFilmArtwork(film)?.stills ?? []

/** The real image to use as a wide "still" for a film, if one exists. */
export const sceneImageOf = (film: Film) => {
  const artwork = resolveFilmArtwork(film)
  return artwork?.backdrop ?? artwork?.stills?.[0]
}

export const artworkSourceUrl = (film: Film) => {
  const artwork = resolveFilmArtwork(film)
  return (
    artwork?.poster?.sourceUrl ??
    artwork?.backdrop?.sourceUrl ??
    (film.tmdbId ? `https://www.themoviedb.org/movie/${film.tmdbId}` : undefined)
  )
}

export const artworkVerifiedAt = (film: Film) => resolveFilmArtwork(film)?.verifiedAt

export const isTmdbArtwork = (film: Film) => {
  const artwork = resolveFilmArtwork(film)
  return Boolean(artwork?.poster?.provider === 'tmdb' || artwork?.backdrop?.provider === 'tmdb')
}
