/**
 * Asset helpers.
 *
 * Vite serves `public/` from `import.meta.env.BASE_URL`. Every runtime image
 * reference has to go through this helper, otherwise the GitHub Pages build
 * (served from /frame-by-frame/) shows broken artwork.
 *
 * `frameSrc` now resolves to *real* film artwork only (TMDB official CDN or a
 * verified local poster). It never returns generated imagery.
 */

import { FILM_BY_ID } from '@/data/films'
import type { Film } from '@/types'
import { imageUrl, posterOf, sceneImageOf, type TmdbSize } from '@/lib/artwork'

const base = import.meta.env.BASE_URL || '/'

export const withBase = (path: string) => `${base}${path.replace(/^\/+/, '')}`

/**
 * A wide, real frame for a film: TMDB backdrop, then its official poster.
 * Accepts a Film object so catalogue additions (not present in the seed
 * registry) still resolve their own artwork instead of an empty src.
 */
export const frameSrc = (film: Film | string, size: TmdbSize = 'w1280') => {
  const resolved = typeof film === 'string' ? FILM_BY_ID[film] : film
  if (!resolved) return ''
  const image = sceneImageOf(resolved) ?? posterOf(resolved)
  return image ? imageUrl(image, size) : ''
}

/** Empty-state / fallback artwork: a real catalogue backdrop, never generated. */
export const COVER_FRAME = frameSrc('manchester')

export const LEGACY_HERO = COVER_FRAME

/**
 * Portrait slots may need a focal point. Official posters are already composed
 * for portrait use, so this only nudges the crop of wide backdrops.
 */
export const portraitPosition = (filmId: string) => {
  const overrides: Record<string, string> = {
    shawshank: '50% 52%',
    manchester: '50% 46%',
    interstellar: '50% 50%',
    'la-la-land': '50% 62%',
    'grand-budapest': '50% 48%',
    'inside-out': '50% 55%',
  }
  return overrides[filmId] ?? '50% 45%'
}
