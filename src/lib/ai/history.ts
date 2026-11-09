import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { clamp } from '@/lib/format'
import type { AiHistoryItem } from './types'
import type { Film, WatchRecord } from '@/types'
import { filmById } from '@/lib/tasteEngine'

/**
 * Only the films that can actually help the current reading are sent:
 * same director, shared themes/moods, then the most recent records.
 * The whole archive is never uploaded.
 */
export const buildAnalysisHistory = (
  records: WatchRecord[],
  films: Film[],
  currentFilm: Film | null,
  limit = 8,
): AiHistoryItem[] => {
  const scored = records
    .map((record) => {
      const film = filmById(films, record.filmId)
      if (!film) return null
      if (currentFilm && film.id === currentFilm.id) return null
      const sharedThemes = currentFilm
        ? record.themes.filter((theme) => currentFilm.themes[theme] !== undefined).length
        : 0
      const sharedMoods = currentFilm
        ? record.moods.filter((mood) => currentFilm.moods[mood] !== undefined).length
        : 0
      const sameDirector = currentFilm && film.director === currentFilm.director ? 4 : 0
      const recency = record.watchedAt ? Date.parse(`${record.watchedAt}T12:00:00`) / 1e12 : 0
      return {
        record,
        film,
        score: sameDirector + sharedThemes * 1.4 + sharedMoods * 0.8 + recency,
      }
    })
    .filter((item): item is { record: WatchRecord; film: Film; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit))

  return scored.map(({ record, film }) => ({
    id: film.id,
    title: film.title,
    year: film.year,
    rating: record.rating,
    director: film.director,
    themes: record.themes,
    moods: record.moods,
    ...(record.ai.summary ? { summary: record.ai.summary.slice(0, 160) } : {}),
  }))
}

export const filmMetaForAi = (film: Film) => ({
  id: film.id,
  title: film.title,
  ...(film.titleZh ? { titleZh: film.titleZh } : {}),
  year: film.year,
  ...(film.director ? { director: film.director } : {}),
  ...(film.genres.length ? { genres: film.genres } : {}),
  ...(film.country && film.country !== '—' ? { country: film.country } : {}),
  ...(film.language && film.language !== '—' ? { language: film.language } : {}),
  ...(film.runtime ? { runtime: film.runtime } : {}),
  ...(film.logline ? { logline: film.logline } : {}),
})

export const moodLabel = (id: string): string =>
  MOODS[id as keyof typeof MOODS]?.zh ?? id

export const themeLabel = (id: string): string =>
  THEMES[id as keyof typeof THEMES]?.zh ?? id

export const dimensionLabel = (key: string): string =>
  DIMENSIONS.find((dimension) => dimension.key === key)?.labelZh ?? key

export const clampUnit = (value: number): number => clamp(Number.isFinite(value) ? value : 0, 0, 1)
