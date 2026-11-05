import type { AppState, Film, WatchRecord } from '@/types'
import { STORAGE_KEY, STORAGE_VERSION } from '@/data/taxonomy'
import { createInitialState } from '@/data/seed'

type LoadResult = {
  state: AppState
  source: 'seed' | 'storage' | 'unavailable'
  recovered: boolean
}

const isRecord = (value: unknown): value is WatchRecord => {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.filmId === 'string' && typeof r.rating === 'number'
}

const isFilm = (value: unknown): value is Film => {
  if (!value || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return typeof f.id === 'string' && typeof f.title === 'string' && typeof f.year === 'number'
}

const readStorage = (): LoadResult => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { state: createInitialState(), source: 'seed', recovered: false }
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (!parsed || !Array.isArray(parsed.records) || parsed.version !== STORAGE_VERSION) {
      return { state: createInitialState(), source: 'seed', recovered: false }
    }
    const records = parsed.records.filter(isRecord)
    const customFilms = Array.isArray(parsed.customFilms) ? parsed.customFilms.filter(isFilm) : []
    return {
      state: {
        ...createInitialState(),
        ...parsed,
        version: STORAGE_VERSION,
        records,
        customFilms,
        feedback: parsed.feedback ?? {},
        timelineFeedback: parsed.timelineFeedback ?? {},
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        yearbookGenerations: Array.isArray(parsed.yearbookGenerations)
          ? parsed.yearbookGenerations
          : [],
      },
      source: 'storage',
      recovered: records.length !== parsed.records.length,
    }
  } catch {
    return { state: createInitialState(), source: 'unavailable', recovered: false }
  }
}

export const loadState = (): LoadResult => readStorage()

export const persistState = (state: AppState): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const clearState = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export const relisten = (handler: (state: AppState) => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue) as AppState
      if (parsed && Array.isArray(parsed.records)) handler(parsed)
    } catch {
      /* ignore malformed cross-tab writes */
    }
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
