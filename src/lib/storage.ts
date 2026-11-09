import type {
  AIAnalysisVerdict,
  AIFilmAnalysis,
  AppState,
  Film,
  TasteProfileEvent,
  WatchRecord,
} from '@/types'
import { STORAGE_KEY, STORAGE_VERSION, DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { createInitialState } from '@/data/seed'
import { FILMS } from '@/data/films'
import { buildSeedAnalyses } from '@/data/seedAnalyses'

type LoadResult = {
  state: AppState
  source: 'seed' | 'storage' | 'unavailable'
  recovered: boolean
  /** True when an older schema was lifted to the current version. */
  migrated: boolean
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

const VERDICTS: AIAnalysisVerdict[] = ['unreviewed', 'accepted', 'edited', 'rejected']
const dimensionKeys = new Set(DIMENSIONS.map((dimension) => dimension.key))
const themeKeys = new Set(Object.keys(THEMES))
const moodKeys = new Set(Object.keys(MOODS))

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const numberOf = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Never invent or drop user data here. We only fill missing scaffolding so a
 * v1 archive keeps every record, note and rating it had.
 */
const normaliseRecord = (value: WatchRecord): WatchRecord => {
  const record = value as WatchRecord & { ai?: Record<string, unknown> }
  const ai: Record<string, unknown> =
    record.ai && typeof record.ai === 'object'
      ? (record.ai as unknown as Record<string, unknown>)
      : {}
  return {
    ...record,
    rating: numberOf(record.rating, 0),
    reflection: str(record.reflection),
    themes: Array.isArray(record.themes) ? record.themes.filter((id) => themeKeys.has(id)) : [],
    moods: Array.isArray(record.moods) ? record.moods.filter((id) => moodKeys.has(id)) : [],
    createdAt: str(record.createdAt, new Date().toISOString()),
    updatedAt: str(record.updatedAt, record.createdAt ?? new Date().toISOString()),
    source: record.source === 'seed' ? 'seed' : 'user',
    ai: {
      summary: str(ai.summary),
      extractedFrom:
        ai.extractedFrom === 'seed' || ai.extractedFrom === 'backend'
          ? ai.extractedFrom
          : 'local-engine',
      confidence: numberOf(ai.confidence, 0),
      ...(typeof ai.status === 'string' ? { status: ai.status as WatchRecord['ai']['status'] } : {}),
      ...(typeof ai.model === 'string' ? { model: ai.model } : {}),
      ...(typeof ai.promptVersion === 'string' ? { promptVersion: ai.promptVersion } : {}),
      ...(typeof ai.analysedAt === 'string' ? { analysedAt: ai.analysedAt } : {}),
    },
  }
}

const normaliseAnalysis = (value: unknown): AIFilmAnalysis | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.recordId !== 'string' || typeof raw.filmId !== 'string') return null
  const reviewRaw = (raw.review ?? {}) as Record<string, unknown>
  const verdict = VERDICTS.includes(reviewRaw.verdict as AIAnalysisVerdict)
    ? (reviewRaw.verdict as AIAnalysisVerdict)
    : 'unreviewed'
  const modelRaw = (raw.model ?? {}) as Record<string, unknown>
  const contributions = Array.isArray(raw.preference_evidence)
    ? raw.preference_evidence
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const contribution = item as Record<string, unknown>
          if (typeof contribution.dimension_id !== 'string') return null
          if (!dimensionKeys.has(contribution.dimension_id as never)) return null
          if (
            contribution.direction !== 'low' &&
            contribution.direction !== 'high' &&
            contribution.direction !== 'neutral'
          ) {
            return null
          }
          return {
            dimension_id: contribution.dimension_id as AIFilmAnalysis['preference_evidence'][number]['dimension_id'],
            direction: contribution.direction,
            strength: numberOf(contribution.strength, 0),
            confidence: numberOf(contribution.confidence, 0),
            evidence: str(contribution.evidence),
            ...(typeof contribution.quote === 'string' ? { quote: contribution.quote } : {}),
            ...(contribution.userStatus === 'kept' || contribution.userStatus === 'removed'
              ? { userStatus: contribution.userStatus }
              : {}),
          }
        })
        .filter((item): item is AIFilmAnalysis['preference_evidence'][number] => item !== null)
    : []

  return {
    schemaVersion: 1,
    recordId: raw.recordId,
    filmId: raw.filmId,
    status: 'complete',
    summary: str(raw.summary),
    observed_emotions: Array.isArray(raw.observed_emotions)
      ? (raw.observed_emotions as AIFilmAnalysis['observed_emotions'])
      : [],
    themes_identified: Array.isArray(raw.themes_identified)
      ? (raw.themes_identified as AIFilmAnalysis['themes_identified'])
      : [],
    narrative_observations: Array.isArray(raw.narrative_observations)
      ? (raw.narrative_observations as string[])
      : [],
    character_observations: Array.isArray(raw.character_observations)
      ? (raw.character_observations as string[])
      : [],
    visual_observations: Array.isArray(raw.visual_observations)
      ? (raw.visual_observations as string[])
      : [],
    liked: Array.isArray(raw.liked) ? (raw.liked as string[]) : [],
    disliked: Array.isArray(raw.disliked) ? (raw.disliked as string[]) : [],
    preference_evidence: contributions,
    uncertainties: Array.isArray(raw.uncertainties) ? (raw.uncertainties as string[]) : [],
    confidence: numberOf(raw.confidence, 0),
    related_films: Array.isArray(raw.related_films)
      ? (raw.related_films as AIFilmAnalysis['related_films'])
      : [],
    model: {
      provider: str(modelRaw.provider, 'unknown'),
      model: str(modelRaw.model, 'unknown'),
      promptVersion: str(modelRaw.promptVersion, 'unknown'),
      analyzedAt: str(modelRaw.analyzedAt, new Date().toISOString()),
      ...(typeof modelRaw.latencyMs === 'number' ? { latencyMs: modelRaw.latencyMs } : {}),
      ...(typeof modelRaw.inputChars === 'number' ? { inputChars: modelRaw.inputChars } : {}),
    },
    review: {
      verdict,
      ...(typeof reviewRaw.note === 'string' ? { note: reviewRaw.note } : {}),
      updatedAt: str(reviewRaw.updatedAt, new Date().toISOString()),
    },
  }
}

const normaliseHistory = (value: unknown): TasteProfileEvent[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const event = item as Record<string, unknown>
      if (typeof event.id !== 'string' || typeof event.at !== 'string') return null
      const kind = event.kind
      if (
        kind !== 'accept' &&
        kind !== 'edit' &&
        kind !== 'reject' &&
        kind !== 'delete' &&
        kind !== 'correction'
      ) {
        return null
      }
      return {
        id: event.id,
        at: event.at,
        ...(typeof event.recordId === 'string' ? { recordId: event.recordId } : {}),
        ...(typeof event.filmTitle === 'string' ? { filmTitle: event.filmTitle } : {}),
        kind,
        filmCount: numberOf(event.filmCount, 0),
        acceptedCount: numberOf(event.acceptedCount, 0),
        changes: Array.isArray(event.changes)
          ? (event.changes as TasteProfileEvent['changes'])
          : [],
        reason: str(event.reason),
      }
    })
    .filter((item): item is TasteProfileEvent => item !== null)
    .slice(0, 80)
}

const migrate = (parsed: Record<string, unknown>): AppState => {
  const base = createInitialState()
  const rawRecords = Array.isArray(parsed.records) ? parsed.records : base.records
  const records = rawRecords
    .filter(isRecord)
    .map(normaliseRecord)
  const customFilms = Array.isArray(parsed.customFilms) ? parsed.customFilms.filter(isFilm) : []
  const analyses = Array.isArray(parsed.analyses)
    ? parsed.analyses
        .map(normaliseAnalysis)
        .filter((item): item is AIFilmAnalysis => item !== null)
    : // Older archives predate the AI layer. Seed their demo records once so
      // the taste page is not blank, without inventing analyses for user films.
      buildSeedAnalyses(
        records.filter((record) => record.source === 'seed'),
        [...FILMS, ...customFilms],
      )
  // Drop analyses whose record disappeared, so the profile cannot cite ghosts.
  const alive = new Set(records.map((record) => record.id))
  const settings =
    parsed.settings && typeof parsed.settings === 'object'
      ? (parsed.settings as Record<string, unknown>)
      : {}

  return {
    version: STORAGE_VERSION,
    records,
    feedback:
      parsed.feedback && typeof parsed.feedback === 'object'
        ? (parsed.feedback as AppState['feedback'])
        : {},
    timelineFeedback:
      parsed.timelineFeedback && typeof parsed.timelineFeedback === 'object'
        ? (parsed.timelineFeedback as AppState['timelineFeedback'])
        : {},
    customFilms,
    corrections: Array.isArray(parsed.corrections)
      ? (parsed.corrections as AppState['corrections'])
      : [],
    yearbookGenerations: Array.isArray(parsed.yearbookGenerations)
      ? (parsed.yearbookGenerations as string[])
      : [],
    analyses: analyses.filter((analysis) => alive.has(analysis.recordId)),
    profileHistory: normaliseHistory(parsed.profileHistory),
    settings: { allowAiNotes: settings.allowAiNotes === true },
  }
}

const readStorage = (): LoadResult => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { state: createInitialState(), source: 'seed', recovered: false, migrated: false }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || !Array.isArray(parsed.records)) {
      return { state: createInitialState(), source: 'seed', recovered: false, migrated: false }
    }
    const fromVersion = typeof parsed.version === 'number' ? parsed.version : 1
    const state = migrate(parsed)
    return {
      state,
      source: 'storage',
      recovered: state.records.length !== (parsed.records as unknown[]).length,
      migrated: fromVersion !== STORAGE_VERSION,
    }
  } catch {
    return {
      state: createInitialState(),
      source: 'unavailable',
      recovered: false,
      migrated: false,
    }
  }
}

export const loadState = (): LoadResult => readStorage()

/** Exposed for the migration tests; the runtime path always goes through readStorage. */
export const migrateState = (parsed: Record<string, unknown>): AppState => migrate(parsed)

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
      const parsed = JSON.parse(event.newValue) as Record<string, unknown>
      if (parsed && Array.isArray(parsed.records)) {
        handler(migrate(parsed))
      }
    } catch {
      /* ignore malformed cross-tab writes */
    }
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
