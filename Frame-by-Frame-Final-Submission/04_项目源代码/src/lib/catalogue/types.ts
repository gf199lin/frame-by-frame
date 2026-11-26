/**
 * External film catalogue contracts.
 *
 * A catalogue result is intentionally separate from `Film`: it describes what
 * an external source knows, while `Film` is what the archive stores. Keeping
 * them apart means a failed lookup can never overwrite a user's record.
 */

export type CatalogueSource = 'imdb' | 'tmdb'

export type CatalogueFilm = {
  /** Stable key, e.g. "imdb:tt2948356" or "tmdb:269149". */
  key: string
  source: CatalogueSource
  imdbId?: string
  tmdbId?: number
  title: string
  /** Original-language title, when it differs from the displayed title. */
  originalTitle?: string
  /** Chinese title, when the source returns one. */
  titleZh?: string
  year?: number
  runtime?: number
  directors?: string[]
  cast?: string[]
  genres: string[]
  overview?: string
  posterUrl?: string
  backdropUrl?: string
  rating?: number
  language?: string
  country?: string
}

export type CatalogueErrorKind = 'network' | 'auth' | 'rate-limit' | 'server' | 'unknown'

export class CatalogueError extends Error {
  readonly kind: CatalogueErrorKind
  readonly status?: number

  constructor(kind: CatalogueErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'CatalogueError'
    this.kind = kind
    this.status = status
  }
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
