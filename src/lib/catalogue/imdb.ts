import { CatalogueError, isAbortError, type CatalogueFilm } from './types'

/**
 * Keyless catalogue: the public Cinemeta addon returns IMDb metadata and the
 * official IMDb poster for a title. It needs no API key, sends
 * `Access-Control-Allow-Origin: *`, and understands Chinese queries, which is
 * why it is the default source on a static GitHub Pages build.
 *
 * It is a discovery source only. Everything it returns is real film metadata;
 * nothing is generated.
 */

const BASE = 'https://v3-cinemeta.strem.io'
const TIMEOUT = 15_000

type CinemetaMeta = {
  id?: string
  imdb_id?: string
  type?: string
  name?: string
  poster?: string
  background?: string
  releaseInfo?: string
  year?: string
  description?: string
  genre?: string[]
  genres?: string[]
  runtime?: string
  director?: string[]
  cast?: string[]
  imdbRating?: string
}

type CinemetaResponse = {
  metas?: CinemetaMeta[]
  meta?: CinemetaMeta
}

const request = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      if (response.status === 429) {
        throw new CatalogueError(
          'rate-limit',
          'The catalogue is limiting requests. Wait a moment and try again.',
          429,
        )
      }
      if (response.status === 401 || response.status === 403) {
        throw new CatalogueError('auth', 'The catalogue rejected this request.', response.status)
      }
      throw new CatalogueError(
        'server',
        `The catalogue answered with status ${response.status}.`,
        response.status,
      )
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof CatalogueError) throw error
    if (signal?.aborted || (isAbortError(error) && !timedOut)) throw error
    if (timedOut) {
      throw new CatalogueError(
        'network',
        'The catalogue took too long to answer. Check your connection and try again.',
      )
    }
    throw new CatalogueError(
      'network',
      'Unable to reach the movie catalogue. Check your connection and try again.',
    )
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export const parseReleaseYear = (value?: string): number | undefined => {
  const match = value?.match(/(18|19|20)\d{2}/)
  return match ? Number(match[0]) : undefined
}

/**
 * IMDb serves `..._V1_SX250.jpg`. Swap the width token for a larger render so a
 * 56px search thumbnail and a 300px detail poster both look sharp.
 */
export const upgradeImdbImage = (url?: string, width = 600): string | undefined => {
  if (!url) return undefined
  if (!/m\.media-amazon\.com|images\.metahub\.space/i.test(url)) return url
  return url
    .replace(/([._])SX\d+/i, `$1SX${width}`)
    .replace(/([._])SY\d+/i, `$1SY${Math.round(width * 1.5)}`)
}

const toCatalogueFilm = (meta: CinemetaMeta): CatalogueFilm | null => {
  const imdbId = meta.imdb_id ?? meta.id
  if (!imdbId || !meta.name) return null
  return {
    key: `imdb:${imdbId}`,
    source: 'imdb',
    imdbId,
    title: meta.name,
    year: parseReleaseYear(meta.releaseInfo ?? meta.year),
    genres: meta.genre ?? meta.genres ?? [],
    overview: meta.description,
    posterUrl: upgradeImdbImage(meta.poster),
    backdropUrl: meta.background,
    rating: meta.imdbRating ? Number(meta.imdbRating) : undefined,
  }
}

export const searchImdb = async (term: string, signal?: AbortSignal): Promise<CatalogueFilm[]> => {
  const url = `${BASE}/catalog/movie/top/search=${encodeURIComponent(term)}.json`
  const data = await request<CinemetaResponse>(url, signal)
  return (data.metas ?? [])
    .filter((meta) => !meta.type || meta.type === 'movie')
    .map(toCatalogueFilm)
    .filter((film): film is CatalogueFilm => film !== null)
}

export const fetchImdbDetail = async (
  imdbId: string,
  signal?: AbortSignal,
): Promise<Partial<CatalogueFilm>> => {
  const url = `${BASE}/meta/movie/${encodeURIComponent(imdbId)}.json`
  const data = await request<CinemetaResponse>(url, signal)
  const meta = data.meta
  if (!meta) return {}

  const runtime = Number.parseInt(meta.runtime ?? '', 10)
  return {
    title: meta.name,
    year: parseReleaseYear(meta.releaseInfo ?? meta.year),
    runtime: Number.isFinite(runtime) && runtime > 0 ? runtime : undefined,
    directors: meta.director?.filter(Boolean),
    cast: meta.cast?.filter(Boolean).slice(0, 10),
    genres: meta.genre ?? meta.genres ?? [],
    overview: meta.description,
    posterUrl: upgradeImdbImage(meta.poster),
    backdropUrl: meta.background,
    rating: meta.imdbRating ? Number(meta.imdbRating) : undefined,
  }
}
