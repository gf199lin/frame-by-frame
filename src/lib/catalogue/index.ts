import type { Film, WatchRecord } from '@/types'
import { imageUrl, posterOf } from '@/lib/artwork'
import { fetchImdbDetail, searchImdb } from './imdb'
import { fetchTmdbDetail, searchTmdb } from './tmdb'
import type { CatalogueFilm } from './types'

export { CatalogueError } from './types'
export type { CatalogueFilm, CatalogueSource } from './types'
export { filmFromCatalogue, filmIdForCatalogue } from './factory'

/**
 * Search orchestration: external providers + the local catalogue, merged and
 * de-duplicated. Each provider is independent; a failure in the optional TMDB
 * provider never hides the keyless IMDb results.
 */

export type SearchHit = {
  key: string
  title: string
  titleZh?: string
  originalTitle?: string
  year?: number
  posterUrl?: string
  genres: string[]
  overview?: string
  source: 'archive' | 'imdb' | 'tmdb'
  localFilm?: Film
  catalogue?: CatalogueFilm
  inArchive: boolean
  recordId?: string
}

export type SearchRequest = {
  query: string
  films: Film[]
  records: WatchRecord[]
  signal?: AbortSignal
}

const normalize = (value?: string) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .trim()

const parseQuery = (raw: string) => {
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  const match = cleaned.match(/\s*[([]?((?:18|19|20)\d{2})[)\]]?\s*$/)
  const year = match ? Number(match[1]) : undefined
  const term = match ? cleaned.slice(0, match.index).trim() : cleaned
  return { term: term || cleaned, year }
}

const titleKeys = (film: CatalogueFilm): string[] =>
  Array.from(
    new Set(
      [film.title, film.originalTitle, film.titleZh]
        .map(normalize)
        .filter((value) => value.length > 0),
    ),
  )

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'by', 'in', 'to', 'le', 'la', 'les'])

const isDuplicate = (candidate: CatalogueFilm, existing: CatalogueFilm[]): boolean => {
  const keys = titleKeys(candidate)
  return existing.some((film) => {
    if (candidate.imdbId && film.imdbId && candidate.imdbId === film.imdbId) return true
    if (candidate.tmdbId && film.tmdbId && candidate.tmdbId === film.tmdbId) return true
    const otherKeys = titleKeys(film)
    const sharesTitle = keys.some((key) => otherKeys.includes(key))
    if (!sharesTitle) return false
    if (!candidate.year || !film.year) return true
    return Math.abs(candidate.year - film.year) <= 1
  })
}

const CACHE_TTL = 10 * 60 * 1000
const CACHE_MAX = 40
const cache = new Map<string, { at: number; films: CatalogueFilm[] }>()

const searchExternal = async (
  term: string,
  year: number | undefined,
  signal?: AbortSignal,
): Promise<CatalogueFilm[]> => {
  const cacheKey = `${term.toLowerCase()}|${year ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.films

  const settled = await Promise.allSettled([
    searchImdb(term, signal),
    searchTmdb(term, year, signal),
  ])
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const imdb = settled[0]
  const tmdb = settled[1]
  const merged: CatalogueFilm[] = []

  if (tmdb.status === 'fulfilled') {
    for (const film of tmdb.value) {
      if (!isDuplicate(film, merged)) merged.push(film)
    }
  }
  if (imdb.status === 'fulfilled') {
    for (const film of imdb.value) {
      if (!isDuplicate(film, merged)) merged.push(film)
    }
  }

  const allFailed = settled.every((result) => result.status === 'rejected')
  if (allFailed) {
    const reason = (settled.find((result) => result.status === 'rejected') as PromiseRejectedResult)
      .reason
    throw reason instanceof Error
      ? reason
      : new Error('Unable to reach the movie catalogue.')
  }

  for (const [index, result] of settled.entries()) {
    if (result.status === 'rejected' && index === 0) {
      const reason = result.reason as Error
      if (reason?.name !== 'AbortError') {
        console.warn('[catalogue] IMDb search failed', reason?.message)
      }
    }
  }

  if (!merged.length) {
    cache.set(cacheKey, { at: Date.now(), films: merged })
  } else {
    if (cache.size >= CACHE_MAX) {
      const oldest = Array.from(cache.entries()).sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) cache.delete(oldest[0])
    }
    cache.set(cacheKey, { at: Date.now(), films: merged })
  }
  return merged
}

const matchesLocal = (film: Film, term: string) => {
  const q = term.toLowerCase()
  return (
    film.title.toLowerCase().includes(q) ||
    film.titleZh.toLowerCase().includes(q) ||
    film.director.toLowerCase().includes(q) ||
    String(film.year) === q ||
    film.genres.some((genre) => genre.toLowerCase().includes(q))
  )
}

const findLocalFilm = (catalogue: CatalogueFilm, films: Film[]): Film | undefined => {
  const keys = titleKeys(catalogue)
  return films.find((film) => {
    if (catalogue.imdbId && film.imdbId === catalogue.imdbId) return true
    if (catalogue.tmdbId && film.tmdbId === catalogue.tmdbId) return true
    const localKeys = [film.title, film.titleZh].map(normalize).filter(Boolean)
    const sharesTitle = keys.some((key) => localKeys.includes(key))
    if (!sharesTitle) return false
    if (!catalogue.year || !film.year) return true
    return Math.abs(catalogue.year - film.year) <= 1
  })
}

const scoreHit = (hit: SearchHit, term: string, year?: number): number => {
  const q = normalize(term)
  const titles = [hit.title, hit.titleZh, hit.originalTitle].map(normalize)
  let score = 0
  if (titles.some((title) => title === q)) score += 320
  else if (titles.some((title) => title.startsWith(q))) score += 170
  else if (titles.some((title) => title.includes(q))) score += 70
  if (hit.source === 'archive') score += 400
  if (year && hit.year === year) score += 90
  return score
}

const toHit = (
  hit: Omit<SearchHit, 'inArchive' | 'recordId'>,
  recordByFilmId: Map<string, string>,
): SearchHit => {
  const recordId = hit.localFilm ? recordByFilmId.get(hit.localFilm.id) : undefined
  return { ...hit, inArchive: Boolean(recordId), recordId }
}

export const searchFilms = async ({
  query,
  films,
  records,
  signal,
}: SearchRequest): Promise<SearchHit[]> => {
  const { term, year } = parseQuery(query)
  if (term.length < 2) return []

  const recordByFilmId = new Map(records.map((record) => [record.filmId, record.id]))
  const localMatches = films.filter((film) => matchesLocal(film, term)).slice(0, 6)

  const external = await searchExternal(term, year, signal)

  const hits: SearchHit[] = localMatches.map((film) => {
    const poster = posterOf(film)
    return toHit(
      {
        key: `archive:${film.id}`,
        title: film.title,
        titleZh: film.titleZh || undefined,
        year: film.year,
        posterUrl: poster ? imageUrl(poster, 'w342') : undefined,
        genres: film.genres,
        overview: film.logline,
        source: 'archive',
        localFilm: film,
      },
      recordByFilmId,
    )
  })

  const covered = new Set<string>()
  for (const hit of hits) {
    for (const key of [hit.title, hit.titleZh, hit.originalTitle].map(normalize).filter(Boolean)) {
      covered.add(key)
    }
  }

  const filtered = year
    ? external.filter((film) => film.year === year)
    : external
  const pool = filtered.length > 0 ? filtered : external

  // For a Latin query, keep only titles that contain every meaningful token.
  // Without this, a loose search such as "The Grand Budapest Hotel" trails off
  // into unrelated films that merely share the word "grand".
  const tokens = /[\u3400-\u9fff]/.test(term)
    ? []
    : normalize(term)
        .split(' ')
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))

  for (const catalogue of pool) {
    if (tokens.length > 0) {
      const haystack = [catalogue.title, catalogue.originalTitle].map(normalize).join(' ')
      if (!tokens.every((token) => haystack.includes(token))) continue
    }
    const local = findLocalFilm(catalogue, films)
    const keys = titleKeys(catalogue)
    if (keys.some((key) => covered.has(key))) continue

    if (local) {
      const poster = posterOf(local)
      hits.push(
        toHit(
          {
            key: `archive:${local.id}`,
            title: local.title,
            titleZh: local.titleZh || catalogue.titleZh,
            year: local.year,
            posterUrl: poster ? imageUrl(poster, 'w342') : catalogue.posterUrl,
            genres: local.genres,
            overview: local.logline,
            source: 'archive',
            localFilm: local,
          },
          recordByFilmId,
        ),
      )
    } else {
      hits.push(
        toHit(
          {
            key: catalogue.key,
            title: catalogue.title,
            titleZh: catalogue.titleZh,
            originalTitle:
              catalogue.originalTitle && catalogue.originalTitle !== catalogue.title
                ? catalogue.originalTitle
                : undefined,
            year: catalogue.year,
            posterUrl: catalogue.posterUrl,
            genres: catalogue.genres,
            overview: catalogue.overview,
            source: catalogue.source,
            catalogue,
          },
          recordByFilmId,
        ),
      )
    }
    for (const key of keys) covered.add(key)
  }

  return hits
    .sort((a, b) => scoreHit(b, term, year) - scoreHit(a, term, year))
    .slice(0, 12)
}

const detailCache = new Map<string, Partial<CatalogueFilm>>()

export const loadCatalogueDetail = async (
  catalogue: CatalogueFilm,
  signal?: AbortSignal,
): Promise<Partial<CatalogueFilm>> => {
  const cached = detailCache.get(catalogue.key)
  if (cached) return cached

  let detail: Partial<CatalogueFilm> = {}
  if (catalogue.source === 'imdb' && catalogue.imdbId) {
    detail = await fetchImdbDetail(catalogue.imdbId, signal)
  } else if (catalogue.source === 'tmdb' && catalogue.tmdbId) {
    detail = await fetchTmdbDetail(catalogue.tmdbId, signal)
  }
  detailCache.set(catalogue.key, detail)
  return detail
}
