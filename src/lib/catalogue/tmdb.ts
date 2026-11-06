import { CatalogueError, isAbortError, type CatalogueFilm } from './types'

/**
 * Optional TMDB provider.
 *
 * TMDB requires a key, and a key embedded in a GitHub Pages bundle is public.
 * So the token is never compiled into the app: it is supplied by the reader at
 * runtime and kept in this browser's localStorage. The keyless IMDb provider
 * remains the default, which means a missing or invalid token degrades to a
 * normal search instead of an error screen.
 */

const BASE = 'https://api.tmdb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const TOKEN_KEY = 'fbf.tmdb.token'
const TIMEOUT = 15_000

export const readTmdbToken = (): string => {
  try {
    return window.localStorage.getItem(TOKEN_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export const writeTmdbToken = (token: string): void => {
  try {
    if (token.trim()) window.localStorage.setItem(TOKEN_KEY, token.trim())
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export const hasTmdb = (): boolean => Boolean(readTmdbToken())

const request = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const token = readTmdbToken()
  if (!token) throw new CatalogueError('auth', 'No TMDB token is configured.')

  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  const bearer = token.startsWith('eyJ')
  const url = bearer
    ? `${BASE}${path}`
    : `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(token)}`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (bearer) headers.authorization = `Bearer ${token}`

  try {
    const response = await fetch(url, { signal: controller.signal, headers })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new CatalogueError('auth', 'TMDB rejected the token.', response.status)
      }
      if (response.status === 429) {
        throw new CatalogueError('rate-limit', 'TMDB is limiting requests.', 429)
      }
      throw new CatalogueError('server', `TMDB answered with status ${response.status}.`, response.status)
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof CatalogueError) throw error
    if (signal?.aborted || (isAbortError(error) && !timedOut)) throw error
    throw new CatalogueError(
      'network',
      timedOut
        ? 'TMDB took too long to answer.'
        : 'Unable to reach TMDB. The host may be blocked on this network.',
    )
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

type TmdbMovie = {
  id: number
  title: string
  original_title: string
  release_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  vote_average?: number
  original_language?: string
  genre_ids?: number[]
}

type TmdbList = { results?: TmdbMovie[] }

type TmdbDetail = TmdbMovie & {
  runtime?: number
  genres?: Array<{ name: string }>
  credits?: {
    crew?: Array<{ job?: string; name?: string }>
    cast?: Array<{ name?: string }>
  }
  production_countries?: Array<{ name?: string }>
  spoken_languages?: Array<{ english_name?: string; name?: string }>
}

const posterUrl = (path?: string | null) => (path ? `${IMAGE_BASE}/w500${path}` : undefined)
const backdropUrl = (path?: string | null) => (path ? `${IMAGE_BASE}/w1280${path}` : undefined)

const hasChinese = (value?: string) => Boolean(value && /[\u3400-\u9fff]/.test(value))

const yearOf = (movie: TmdbMovie) => {
  const match = movie.release_date?.match(/^(\d{4})/)
  return match ? Number(match[1]) : undefined
}

const toCatalogueFilm = (movie: TmdbMovie, localizedTitle?: string): CatalogueFilm => {
  const zh = hasChinese(localizedTitle) ? localizedTitle : hasChinese(movie.title) ? movie.title : undefined
  const display = localizedTitle || movie.title || movie.original_title || 'Untitled'
  return {
    key: `tmdb:${movie.id}`,
    source: 'tmdb',
    tmdbId: movie.id,
    title: display,
    titleZh: zh,
    originalTitle:
      movie.original_title && movie.original_title !== display ? movie.original_title : undefined,
    year: yearOf(movie),
    genres: [],
    overview: movie.overview,
    posterUrl: posterUrl(movie.poster_path),
    backdropUrl: backdropUrl(movie.backdrop_path),
    rating: movie.vote_average ? Number(movie.vote_average.toFixed(1)) : undefined,
    language: movie.original_language,
  }
}

export const searchTmdb = async (
  term: string,
  year: number | undefined,
  signal?: AbortSignal,
): Promise<CatalogueFilm[]> => {
  if (!readTmdbToken()) return []

  const languages = ['zh-CN', 'en-US']
  const settled = await Promise.allSettled(
    languages.map((language) => {
      const params = new URLSearchParams({
        query: term,
        include_adult: 'false',
        language,
      })
      if (year) params.set('year', String(year))
      return request<TmdbList>(`/search/movie?${params.toString()}`, signal)
    }),
  )

  const fulfilled = settled.filter(
    (result): result is PromiseFulfilledResult<TmdbList> => result.status === 'fulfilled',
  )
  if (fulfilled.length === 0) {
    const first = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    throw first?.reason instanceof Error
      ? first.reason
      : new CatalogueError('unknown', 'TMDB search failed.')
  }

  const merged = new Map<number, CatalogueFilm>()
  const [zhList, enList] = fulfilled.map((result) => result.value.results ?? [])

  for (const movie of zhList) {
    merged.set(movie.id, toCatalogueFilm(movie, movie.title))
  }
  for (const movie of enList) {
    const existing = merged.get(movie.id)
    if (existing) {
      existing.originalTitle = movie.original_title
      if (!hasChinese(existing.title) && movie.title) existing.title = movie.title
    } else {
      merged.set(movie.id, toCatalogueFilm(movie, undefined))
    }
  }
  return Array.from(merged.values())
}

export const fetchTmdbDetail = async (
  tmdbId: number,
  signal?: AbortSignal,
): Promise<Partial<CatalogueFilm>> => {
  const detail = await request<TmdbDetail>(
    `/movie/${tmdbId}?language=zh-CN&append_to_response=credits`,
    signal,
  )
  const directors = (detail.credits?.crew ?? [])
    .filter((person) => person.job === 'Director' && person.name)
    .map((person) => person.name as string)
  const genres = (detail.genres ?? []).map((genre) => genre.name).filter(Boolean)
  const country = detail.production_countries?.[0]?.name
  const language = detail.spoken_languages?.[0]?.english_name

  return {
    title: detail.title,
    titleZh: hasChinese(detail.title) ? detail.title : undefined,
    originalTitle:
      detail.original_title && detail.original_title !== detail.title ? detail.original_title : undefined,
    year: yearOf(detail),
    runtime: detail.runtime && detail.runtime > 0 ? detail.runtime : undefined,
    directors: directors.length ? directors : undefined,
    cast: (detail.credits?.cast ?? [])
      .map((person) => person.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 10),
    genres,
    overview: detail.overview,
    posterUrl: posterUrl(detail.poster_path),
    backdropUrl: backdropUrl(detail.backdrop_path),
    country,
    language,
  }
}
