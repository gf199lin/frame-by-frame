import type { Film, FilmPalette, PosterMotif } from '@/types'
import type { CatalogueFilm } from './types'

/**
 * Turn a catalogue hit into an archive `Film`.
 *
 * The id is derived from the external id, so choosing the same film twice can
 * never create two records. Artwork keeps its provenance: IMDb/TMDB URL, the
 * page it came from, and the credit line. No generated image is ever attached.
 */

export const FILM_PALETTES: FilmPalette[] = [
  { base: '#16212B', deep: '#0A1016', accent: '#8FA7B4', soft: '#283843', paper: '#E4DCCB' },
  { base: '#241A20', deep: '#120C10', accent: '#C79A88', soft: '#3C2A32', paper: '#EADCCB' },
  { base: '#14201A', deep: '#08110C', accent: '#9AAE86', soft: '#26362C', paper: '#E2D9C6' },
  { base: '#1B1A2B', deep: '#0C0B16', accent: '#A9A0CF', soft: '#2C2A44', paper: '#E8E0D2' },
]

export const FILM_MOTIFS: PosterMotif[] = [
  'orbit',
  'shore',
  'stage',
  'dome',
  'forest',
  'mind',
  'signal',
  'city',
]

const hashText = (text: string) =>
  Array.from(text).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7)

type Signature = Film['signature']

const genreSignature = (genres: string[]): Signature => {
  const set = new Set(genres.map((genre) => genre.toLowerCase()))
  const signature: Signature = {
    narrative: 0.5,
    emotion: 0.5,
    thematic: 0.45,
    visual: 0.5,
    character: 0.45,
    ending: 0.5,
  }

  if (set.has('animation') || set.has('family')) {
    signature.visual = 0.8
    signature.emotion = 0.68
  }
  if (set.has('action') || set.has('adventure')) {
    signature.narrative = 0.68
    signature.visual = 0.66
  }
  if (set.has('science fiction') || set.has('sci-fi') || set.has('fantasy')) {
    signature.thematic = 0.68
    signature.visual = 0.62
  }
  if (set.has('comedy')) {
    signature.character = 0.56
    signature.ending = 0.58
  }
  if (set.has('romance')) signature.emotion = 0.76
  if (set.has('drama')) {
    signature.character = 0.62
    signature.emotion = 0.58
  }
  if (set.has('mystery') || set.has('thriller')) signature.narrative = 0.7
  return signature
}

export const filmIdForCatalogue = (catalogue: CatalogueFilm): string =>
  catalogue.imdbId ? `imdb-${catalogue.imdbId}` : `tmdb-${catalogue.tmdbId ?? catalogue.key}`

export const filmFromCatalogue = (catalogue: CatalogueFilm): Film => {
  const hash = hashText(catalogue.key || catalogue.title)
  const sourceUrl = catalogue.imdbId
    ? `https://www.imdb.com/title/${catalogue.imdbId}/`
    : `https://www.themoviedb.org/movie/${catalogue.tmdbId}`
  const credit =
    catalogue.source === 'imdb'
      ? 'Official release poster · IMDb'
      : 'Official release artwork · TMDB'
  const hasPoster = Boolean(catalogue.posterUrl)
  const hasBackdrop = Boolean(catalogue.backdropUrl)

  return {
    id: filmIdForCatalogue(catalogue),
    imdbId: catalogue.imdbId,
    tmdbId: catalogue.tmdbId,
    externalSource: catalogue.source,
    title: catalogue.title.trim() || 'Untitled',
    titleZh:
      catalogue.titleZh && catalogue.titleZh !== catalogue.title ? catalogue.titleZh : '',
    year: catalogue.year ?? 0,
    director: catalogue.directors?.filter(Boolean).join(' / ') || 'Unknown director',
    runtime: catalogue.runtime ?? 0,
    genres: catalogue.genres.filter(Boolean),
    country: catalogue.country || '—',
    language: catalogue.language || '—',
    tagline: '',
    logline: catalogue.overview?.trim() || 'The catalogue lists this film without a synopsis.',
    cast: catalogue.cast ?? [],
    motif: FILM_MOTIFS[hash % FILM_MOTIFS.length],
    palette: FILM_PALETTES[hash % FILM_PALETTES.length],
    artwork:
      hasPoster || hasBackdrop
        ? {
            tmdbId: catalogue.tmdbId,
            poster: hasPoster
              ? {
                  provider: 'remote',
                  url: catalogue.posterUrl,
                  width: 600,
                  height: 900,
                  sourceUrl,
                  credit,
                }
              : undefined,
            backdrop: hasBackdrop
              ? {
                  provider: 'remote',
                  url: catalogue.backdropUrl,
                  width: 1280,
                  height: 720,
                  sourceUrl,
                  credit: 'Official still · IMDb',
                }
              : undefined,
            verifiedAt: new Date().toISOString().slice(0, 10),
            matchSource: catalogue.source === 'imdb' ? 'catalogue-api' : 'tmdb-api',
          }
        : undefined,
    signature: genreSignature(catalogue.genres),
    themes: {},
    moods: {},
    narrativeTags: [],
    characterTags: [],
  }
}
