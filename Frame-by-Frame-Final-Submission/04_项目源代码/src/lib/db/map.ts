import type {
  AIFilmAnalysis,
  AgentObservationBundle,
  AppState,
  DimensionFeedback,
  Film,
  MoodId,
  TasteEvolutionSnapshot,
  TasteFeedbackMap,
  TasteObservationFeedback,
  TasteProfileEvent,
  ThemeId,
  TimelineFeedbackMap,
  WatchRecord,
} from '@/types'
import { STORAGE_VERSION } from '@/data/taxonomy'
import type {
  AgentObservationRow,
  AnalysisRow,
  CorrectionRow,
  EventRow,
  FeedbackRow,
  FilmRow,
  NoteRow,
  ObservationFeedbackRow,
  RemoteData,
  SnapshotRow,
  YearbookRow,
} from './rows'

const STATUSES = new Set<WatchRecord['status']>(['watched', 'rewatched', 'abandoned'])
const EXTRACTED = new Set<WatchRecord['ai']['extractedFrom']>(['seed', 'local-engine', 'backend'])
const VERDICTS = new Set<FeedbackRow['verdict']>(['agree', 'not-quite', 'corrected'])
const DECISIONS = new Set<TasteObservationFeedback['decision']>([
  'accepted',
  'partially_accepted',
  'rejected',
  'unsure',
])
const EVENT_KINDS = new Set<TasteProfileEvent['kind']>([
  'accept',
  'edit',
  'reject',
  'delete',
  'correction',
])

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const noteToRow = (note: WatchRecord, userId: string, film: Film | undefined) => ({
  id: note.id,
  user_id: userId,
  film_key: note.filmId,
  film_snapshot: film
    ? {
        title: film.title,
        titleZh: film.titleZh,
        year: film.year,
        director: film.director,
      }
    : {},
  rating: note.rating,
  watched_at: note.watchedAt.slice(0, 10),
  status: note.status,
  reflection: note.reflection,
  felt_like_tags: note.feltLikeTags ?? (note.feltLike ? [note.feltLike] : []),
  themes: note.themes,
  moods: note.moods,
  ai_summary: note.ai.summary,
  ai_extracted_from: note.ai.extractedFrom,
  ai_confidence: note.ai.confidence,
  source: note.source,
  is_demo: note.source === 'seed',
  created_at: note.createdAt,
  updated_at: note.updatedAt,
})

export const rowToNote = (row: NoteRow): WatchRecord => {
  const status = STATUSES.has(row.status as WatchRecord['status'])
    ? (row.status as WatchRecord['status'])
    : 'watched'
  const extracted = EXTRACTED.has(row.ai_extracted_from as WatchRecord['ai']['extractedFrom'])
    ? (row.ai_extracted_from as WatchRecord['ai']['extractedFrom'])
    : 'local-engine'
  const tags = asStringArray(row.felt_like_tags)
  return {
    id: row.id,
    filmId: row.film_key,
    rating: Number(row.rating),
    watchedAt: row.watched_at,
    status,
    reflection: row.reflection ?? '',
    ...(tags[0] ? { feltLike: tags[0] } : {}),
    feltLikeTags: tags,
    themes: asStringArray(row.themes) as ThemeId[],
    moods: asStringArray(row.moods) as MoodId[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source === 'user' ? 'user' : 'seed',
    ai: {
      summary: row.ai_summary ?? '',
      extractedFrom: extracted,
      confidence: Number(row.ai_confidence),
      status: 'complete',
    },
  }
}

export const analysisToRow = (analysis: AIFilmAnalysis, userId: string) => ({
  id: analysis.recordId,
  user_id: userId,
  note_id: analysis.recordId,
  schema_version: 'film-analysis.v1',
  status: 'succeeded',
  provider: analysis.model.provider || 'unknown',
  agent_id: analysis.agent?.agent_id ?? 'frame-by-frame-curator',
  run: analysis,
  created_at: analysis.review.updatedAt,
})

export const rowToAnalysis = (row: AnalysisRow): AIFilmAnalysis | null => {
  const run = row.run as AIFilmAnalysis | null
  if (!run || typeof run !== 'object' || !Array.isArray(run.preference_evidence)) return null
  return { ...run, recordId: run.recordId || row.note_id }
}

export const filmToRow = (film: Film, userId: string) => ({
  user_id: userId,
  film_key: film.id,
  payload: film,
})

export const snapshotToRow = (snapshot: TasteEvolutionSnapshot, userId: string) => ({
  snapshot_id: snapshot.snapshot_id,
  user_id: userId,
  signature: snapshot.signature,
  run_id: snapshot.run_id,
  record_count: snapshot.record_count,
  overall_confidence: snapshot.overall_confidence,
  observations: snapshot.observations,
  dimensions: snapshot.dimensions,
  changes: snapshot.changes,
  corrections_applied: snapshot.corrections_applied,
  created_at: snapshot.created_at,
})

export const rowToSnapshot = (row: SnapshotRow): TasteEvolutionSnapshot => ({
  snapshot_id: row.snapshot_id,
  created_at: row.created_at,
  run_id: row.run_id,
  record_count: row.record_count,
  observations: row.observations ?? [],
  dimensions: row.dimensions ?? [],
  overall_confidence: Number(row.overall_confidence),
  changes: row.changes ?? [],
  corrections_applied: asStringArray(row.corrections_applied),
  signature: row.signature,
})

export const eventToRow = (event: TasteProfileEvent, userId: string) => ({
  id: event.id,
  user_id: userId,
  kind: event.kind,
  note_id: event.recordId ?? null,
  film_title: event.filmTitle ?? null,
  film_count: event.filmCount,
  accepted_count: event.acceptedCount,
  changes: event.changes,
  reason: event.reason,
  occurred_at: event.at,
})

export const rowToEvent = (row: EventRow): TasteProfileEvent => ({
  id: row.id,
  at: row.occurred_at,
  ...(row.note_id ? { recordId: row.note_id } : {}),
  ...(row.film_title ? { filmTitle: row.film_title } : {}),
  kind: EVENT_KINDS.has(row.kind as TasteProfileEvent['kind'])
    ? (row.kind as TasteProfileEvent['kind'])
    : 'edit',
  filmCount: row.film_count,
  acceptedCount: row.accepted_count,
  changes: (row.changes ?? []) as TasteProfileEvent['changes'],
  reason: row.reason,
})

export const feedbackToRow = (
  scope: FeedbackRow['scope'],
  key: string,
  verdict: FeedbackRow['verdict'],
  correction: string | undefined,
  updatedAt: string,
  userId: string,
) => ({
  user_id: userId,
  scope,
  key,
  verdict,
  correction: correction ?? null,
  updated_at: updatedAt,
})

export const correctionToRow = (
  correction: AppState['corrections'][number],
  userId: string,
) => ({
  id: correction.id,
  user_id: userId,
  scope: correction.scope,
  body: correction.text,
  created_at: correction.createdAt,
})

export const observationFeedbackToRow = (
  feedback: TasteObservationFeedback,
  userId: string,
) => ({
  feedback_id: feedback.feedback_id,
  user_id: userId,
  observation_id: feedback.observation_id,
  decision: feedback.decision,
  user_comment: feedback.user_comment ?? null,
  affected_snapshot_id: feedback.affected_snapshot_id,
  created_at: feedback.created_at,
})

export const rowToObservationFeedback = (row: ObservationFeedbackRow): TasteObservationFeedback => ({
  feedback_id: row.feedback_id,
  observation_id: row.observation_id,
  decision: DECISIONS.has(row.decision as TasteObservationFeedback['decision'])
    ? (row.decision as TasteObservationFeedback['decision'])
    : 'unsure',
  ...(row.user_comment ? { user_comment: row.user_comment } : {}),
  created_at: row.created_at,
  affected_snapshot_id: row.affected_snapshot_id,
})

export const agentObservationToRow = (
  bundle: AgentObservationBundle,
  userId: string,
) => ({
  observation_id: bundle.observation.observation_id,
  user_id: userId,
  run_id: bundle.run_id,
  note_id: bundle.record_id,
  film_id: bundle.film_id,
  note_sha256: bundle.note_sha256,
  analyzed_at: bundle.analyzed_at,
  observation: bundle.observation,
  evidence: bundle.evidence,
  imported_at: bundle.imported_at,
})

export const rowToAgentObservation = (row: AgentObservationRow): AgentObservationBundle => ({
  observation: row.observation as AgentObservationBundle['observation'],
  evidence: (row.evidence ?? []) as AgentObservationBundle['evidence'],
  run_id: row.run_id,
  record_id: row.note_id,
  film_id: row.film_id,
  note_sha256: row.note_sha256,
  analyzed_at: row.analyzed_at,
  imported_at: row.imported_at,
})

export const rowToFilm = (row: FilmRow): Film | null => {
  const payload = row.payload as Film | null
  if (!payload || typeof payload !== 'object' || !payload.id) return null
  return payload
}

export const rowToYearbook = (row: YearbookRow): string => String(row.year)

/** Build a complete AppState from the cloud, without inventing data. */
export const remoteToState = (remote: RemoteData): AppState => {
  const base: AppState = {
    version: STORAGE_VERSION,
    records: [],
    feedback: {},
    timelineFeedback: {},
    customFilms: [],
    corrections: [],
    yearbookGenerations: [],
    analyses: [],
    profileHistory: [],
    observationFeedback: [],
    tasteSnapshots: [],
    agentObservations: [],
    settings: { allowAiNotes: false },
  }
  const feedback: TasteFeedbackMap = {}
  const timelineFeedback: TimelineFeedbackMap = {}
  const noteIds = new Set(remote.notes.map((row) => row.id))

  for (const row of remote.feedback) {
    if (!VERDICTS.has(row.verdict)) continue
    const entry = {
      verdict: row.verdict,
      ...(row.correction ? { correction: row.correction } : {}),
      updatedAt: row.updated_at,
    }
    if (row.scope === 'dimension') {
      feedback[row.key as keyof TasteFeedbackMap] = entry as DimensionFeedback
    } else {
      timelineFeedback[row.key] = entry
    }
  }

  return {
    ...base,
    version: STORAGE_VERSION,
    records: remote.notes.map(rowToNote),
    customFilms: remote.films
      .map(rowToFilm)
      .filter((film): film is Film => film !== null),
    analyses: remote.analyses
      .map(rowToAnalysis)
      .filter((analysis): analysis is AIFilmAnalysis => analysis !== null)
      .filter((analysis) => noteIds.has(analysis.recordId)),
    tasteSnapshots: remote.snapshots
      .map(rowToSnapshot)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 80),
    profileHistory: remote.events.map(rowToEvent).slice(0, 80),
    feedback,
    timelineFeedback,
    corrections: remote.corrections.map((row: CorrectionRow) => ({
      id: row.id,
      scope: row.scope,
      text: row.body,
      createdAt: row.created_at,
    })),
    yearbookGenerations: remote.yearbook.map(rowToYearbook),
    observationFeedback: remote.observationFeedback.map(rowToObservationFeedback),
    agentObservations: remote.agentObservations.map(rowToAgentObservation),
    settings: { allowAiNotes: remote.profile?.allow_ai_notes ?? false },
  }
}

