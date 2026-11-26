import type {
  AIAnalysisVerdict,
  AIFilmAnalysis,
  AgentObservationBundle,
  AppState,
  Film,
  TasteEvolutionSnapshot,
  TasteObservationFeedback,
  TasteProfileEvent,
  WatchRecord,
} from '@/types'
import { STORAGE_KEY, STORAGE_VERSION, DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { createInitialState } from '@/data/seed'
import { FILMS } from '@/data/films'
import { buildSeedAnalyses } from '@/data/seedAnalyses'
import { isAgentRunV2, runV2ToAnalysis } from '@/lib/ai/normaliseRunV2'

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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
  const feltLikeTags = Array.isArray(record.feltLikeTags)
    ? record.feltLikeTags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6)
    : typeof record.feltLike === 'string' && record.feltLike.trim()
      ? [record.feltLike.trim()]
      : []
  return {
    ...record,
    rating: numberOf(record.rating, 0),
    reflection: str(record.reflection),
    feltLikeTags,
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
  // Agent runs (agent-run.v2) are a different shape from a persisted
  // AIFilmAnalysis. Convert them instead of dropping the whole result.
  if (isAgentRunV2(value)) {
    const converted = runV2ToAnalysis(value)
    if (converted) return converted
  }
  const raw = value as Record<string, unknown>
  const recordId =
    (typeof raw.recordId === 'string' && raw.recordId) ||
    (typeof raw.record_id === 'string' && raw.record_id) ||
    (isPlainObject(raw.input) && typeof raw.input.record_id === 'string' ? raw.input.record_id : '')
  const inputFilm = isPlainObject(raw.input) && isPlainObject(raw.input.film) ? raw.input.film : null
  const analysisRaw = isPlainObject(raw.analysis) ? raw.analysis : null
  const filmId =
    (typeof raw.filmId === 'string' && raw.filmId) ||
    (typeof raw.film_id === 'string' && raw.film_id) ||
    (inputFilm && typeof inputFilm.id === 'string' ? inputFilm.id : '')
  if (!recordId || !filmId) return null
  const reviewRaw = (raw.review ?? {}) as Record<string, unknown>
  const verdict = VERDICTS.includes(reviewRaw.verdict as AIAnalysisVerdict)
    ? (reviewRaw.verdict as AIAnalysisVerdict)
    : 'unreviewed'
  const modelRaw = (raw.model ?? {}) as Record<string, unknown>
  const contributions = Array.isArray(raw.preference_evidence)
    ? raw.preference_evidence
        .map((item): AIFilmAnalysis['preference_evidence'][number] | null => {
          if (!item || typeof item !== 'object') return null
          const contribution = item as Record<string, unknown>
          if (typeof contribution.dimension_id !== 'string') return null
          if (!dimensionKeys.has(contribution.dimension_id as never)) return null
          if (
            contribution.direction !== 'low' &&
            contribution.direction !== 'high' &&
            contribution.direction !== 'neutral' &&
            contribution.direction !== 'ambivalent'
          ) {
            return null
          }
          const direction = contribution.direction as 'low' | 'high' | 'neutral' | 'ambivalent'
          // `interpretation` is the agent's wording; `evidence` is what the
          // website renders. Falling back keeps the reasoning instead of
          // persisting an empty string.
          const evidence = str(contribution.evidence) || str(contribution.interpretation)
          return {
            dimension_id: contribution.dimension_id as AIFilmAnalysis['preference_evidence'][number]['dimension_id'],
            direction: direction === 'ambivalent' ? 'neutral' : direction,
            strength: numberOf(contribution.strength, 0),
            confidence: numberOf(contribution.confidence, 0),
            evidence,
            ...(typeof contribution.quote === 'string' ? { quote: contribution.quote } : {}),
            ...(direction === 'ambivalent' || contribution.raw_direction === 'ambivalent'
              ? { raw_direction: 'ambivalent' as const }
              : {}),
            ...(contribution.userStatus === 'kept' || contribution.userStatus === 'removed'
              ? { userStatus: contribution.userStatus }
              : {}),
          }
        })
        .filter((item): item is AIFilmAnalysis['preference_evidence'][number] => item !== null)
    : []

  const focus = analysisRaw && isPlainObject(analysisRaw.focus) ? analysisRaw.focus : null
  const observations = (key: 'narrative' | 'character' | 'visual', flat: unknown): string[] => {
    if (Array.isArray(flat)) return flat as string[]
    if (focus && Array.isArray(focus[key])) return focus[key] as string[]
    return []
  }
  const analysedAt =
    str(modelRaw.analyzedAt) ||
    str(raw.completed_at) ||
    str(raw.timestamp) ||
    new Date().toISOString()
  const agentRaw = isPlainObject(raw.agent) ? raw.agent : null

  return {
    schemaVersion: 1,
    recordId,
    filmId,
    status: 'complete',
    summary: str(raw.summary) || (analysisRaw ? str(analysisRaw.summary) : ''),
    observed_emotions: Array.isArray(raw.observed_emotions)
      ? (raw.observed_emotions as AIFilmAnalysis['observed_emotions'])
      : analysisRaw && Array.isArray(analysisRaw.observed_emotions)
        ? (analysisRaw.observed_emotions as AIFilmAnalysis['observed_emotions'])
        : [],
    themes_identified: Array.isArray(raw.themes_identified)
      ? (raw.themes_identified as AIFilmAnalysis['themes_identified'])
      : analysisRaw && Array.isArray(analysisRaw.themes_identified)
        ? (analysisRaw.themes_identified as AIFilmAnalysis['themes_identified'])
        : [],
    narrative_observations: observations('narrative', raw.narrative_observations),
    character_observations: observations('character', raw.character_observations),
    visual_observations: observations('visual', raw.visual_observations),
    liked: Array.isArray(raw.liked)
      ? (raw.liked as string[])
      : analysisRaw && Array.isArray(analysisRaw.liked)
        ? (analysisRaw.liked as string[])
        : [],
    disliked: Array.isArray(raw.disliked)
      ? (raw.disliked as string[])
      : analysisRaw && Array.isArray(analysisRaw.disliked)
        ? (analysisRaw.disliked as string[])
        : [],
    preference_evidence: contributions,
    uncertainties: Array.isArray(raw.uncertainties)
      ? (raw.uncertainties as string[])
      : analysisRaw && Array.isArray(analysisRaw.uncertainties)
        ? (analysisRaw.uncertainties as string[])
        : [],
    confidence: numberOf(raw.confidence, analysisRaw ? numberOf(analysisRaw.confidence, 0) : 0),
    related_films: Array.isArray(raw.related_films)
      ? (raw.related_films as AIFilmAnalysis['related_films'])
      : analysisRaw && Array.isArray(analysisRaw.related_films)
        ? (analysisRaw.related_films as AIFilmAnalysis['related_films'])
        : [],
    model: {
      provider: str(modelRaw.provider, 'unknown'),
      model: str(modelRaw.model, 'unknown'),
      promptVersion: str(modelRaw.promptVersion, 'unknown'),
      analyzedAt: analysedAt,
      ...(typeof modelRaw.latencyMs === 'number' ? { latencyMs: modelRaw.latencyMs } : {}),
      ...(typeof modelRaw.inputChars === 'number' ? { inputChars: modelRaw.inputChars } : {}),
    },
    ...(agentRaw ? { agent: agentRaw as AIFilmAnalysis['agent'] } : {}),
    review: {
      verdict,
      ...(typeof reviewRaw.note === 'string' ? { note: reviewRaw.note } : {}),
      updatedAt: str(reviewRaw.updatedAt, analysedAt),
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

const DECISIONS = new Set(['accepted', 'partially_accepted', 'rejected', 'unsure'])

const normaliseObservationFeedback = (value: unknown): TasteObservationFeedback[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const feedback = item as Record<string, unknown>
      if (
        typeof feedback.feedback_id !== 'string' ||
        typeof feedback.observation_id !== 'string' ||
        !feedback.observation_id.startsWith('obs_') ||
        typeof feedback.decision !== 'string' ||
        !DECISIONS.has(feedback.decision) ||
        typeof feedback.created_at !== 'string'
      ) {
        return null
      }
      if (seen.has(feedback.feedback_id)) return null
      seen.add(feedback.feedback_id)
      return {
        feedback_id: feedback.feedback_id,
        observation_id: feedback.observation_id,
        decision: feedback.decision as TasteObservationFeedback['decision'],
        ...(typeof feedback.user_comment === 'string' && feedback.user_comment.trim()
          ? { user_comment: feedback.user_comment }
          : {}),
        created_at: feedback.created_at,
        affected_snapshot_id:
          typeof feedback.affected_snapshot_id === 'string'
            ? feedback.affected_snapshot_id
            : 'unknown',
      }
    })
    .filter((item): item is TasteObservationFeedback => item !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

const normaliseSnapshots = (value: unknown): TasteEvolutionSnapshot[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const snapshot = item as Record<string, unknown>
      if (
        typeof snapshot.snapshot_id !== 'string' ||
        typeof snapshot.created_at !== 'string' ||
        typeof snapshot.signature !== 'string' ||
        !Array.isArray(snapshot.observations)
      ) {
        return null
      }
      return snapshot as unknown as TasteEvolutionSnapshot
    })
    .filter((item): item is TasteEvolutionSnapshot => item !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 80)
}

const normaliseAgentObservations = (value: unknown): AgentObservationBundle[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const bundle = item as Record<string, unknown>
      if (
        typeof bundle.run_id !== 'string' ||
        typeof bundle.record_id !== 'string' ||
        typeof bundle.analyzed_at !== 'string' ||
        !bundle.observation ||
        typeof bundle.observation !== 'object'
      ) {
        return null
      }
      const observation = bundle.observation as Record<string, unknown>
      if (typeof observation.observation_id !== 'string') return null
      return bundle as unknown as AgentObservationBundle
    })
    .filter((item): item is AgentObservationBundle => item !== null)
    .sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at))
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
    observationFeedback: normaliseObservationFeedback(parsed.observationFeedback),
    tasteSnapshots: normaliseSnapshots(parsed.tasteSnapshots),
    agentObservations: normaliseAgentObservations(parsed.agentObservations),
    settings: { allowAiNotes: settings.allowAiNotes === true },
  }
}

/**
 * Per-account local cache.
 *
 * Before accounts existed, every browser shared one key (`fbf.state.v1`).
 * Now each signed-in account writes to `fbf.state.v1.u.<userId>` so two people
 * on the same laptop never see each other's records. The legacy key is kept
 * untouched and claimed once, by the first account that signs in on this
 * browser, so existing memories survive the introduction of authentication.
 */
let storageScope: string | null = null
const LEGACY_CLAIM_KEY = `${STORAGE_KEY}.claimedBy`

export const setStorageScope = (userId: string | null): void => {
  storageScope = userId
}

const activeStorageKey = (): string =>
  storageScope ? `${STORAGE_KEY}.u.${storageScope}` : STORAGE_KEY

/**
 * Copy the pre-account archive into this account's key, exactly once per
 * browser. Returns the raw JSON when adoption happened, otherwise null.
 */
const adoptLegacyInto = (targetKey: string): string | null => {
  if (!storageScope) return null
  try {
    const claimedBy = window.localStorage.getItem(LEGACY_CLAIM_KEY)
    if (claimedBy && claimedBy !== storageScope) return null

    const legacyRaw = window.localStorage.getItem(STORAGE_KEY)
    if (!legacyRaw) return null

    const parsed = JSON.parse(legacyRaw) as Record<string, unknown>
    if (!parsed || !Array.isArray(parsed.records)) return null

    window.localStorage.setItem(targetKey, legacyRaw)
    window.localStorage.setItem(LEGACY_CLAIM_KEY, storageScope)
    return legacyRaw
  } catch {
    return null
  }
}

const readStorage = (): LoadResult => {
  try {
    const key = activeStorageKey()
    let raw = window.localStorage.getItem(key)
    if (!raw) raw = adoptLegacyInto(key)
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
    window.localStorage.setItem(activeStorageKey(), JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const clearState = (): void => {
  try {
    window.localStorage.removeItem(activeStorageKey())
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export const relisten = (handler: (state: AppState) => void): (() => void) => {
  const key = activeStorageKey()
  const listener = (event: StorageEvent) => {
    if (event.key !== key || !event.newValue) return
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
