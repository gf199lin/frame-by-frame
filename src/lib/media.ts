/**
 * Asset helpers.
 *
 * Vite serves `public/` from `import.meta.env.BASE_URL`. Every runtime image
 * reference has to go through this helper, otherwise the GitHub Pages build
 * (served from /frame-by-frame/) shows broken artwork.
 */

const base = import.meta.env.BASE_URL || '/'

export const withBase = (path: string) => `${base}${path.replace(/^\/+/, '')}`

/** A single photographic "memory frame" per film, 1536×928. */
export const frameSrc = (filmId: string) => withBase(`images/frames/${filmId}.jpg`)

export const COVER_FRAME = withBase('images/frames/cover.jpg')

export const LEGACY_HERO = withBase('images/hero-cinema.jpg')

/**
 * Frames are cropped from a wide 1536×928 negative. Portrait slots keep the
 * subject in view by biasing the vertical crop slightly below centre.
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
