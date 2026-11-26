import type { AppState, Film } from '@/types'
import type { QueueOp } from './queue'

/**
 * A fingerprint of everything the cloud already knows. Diffing the current
 * AppState against this shadow produces the minimum set of writes.
 */
export type Shadow = {
  notes: Map<string, string>
  analyses: Map<string, string>
  films: Map<string, string>
  feedback: Map<string, string>
  corrections: Set<string>
  yearbook: Set<string>
  snapshots: Set<string>
  events: Set<string>
  observationFeedback: Set<string>
  agentObservations: Set<string>
  allowAi: boolean | null
}

const hash = (value: unknown): string => {
  const text = JSON.stringify(value) ?? ''
  let h = 5381
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return `${text.length}:${h}`
}

const feedbackKey = (scope: 'dimension' | 'timeline', key: string) => `${scope}:${key}`

export const shadowFromState = (state: AppState): Shadow => {
  const notes = new Map<string, string>()
  for (const record of state.records) notes.set(record.id, hash(record))

  const analyses = new Map<string, string>()
  for (const analysis of state.analyses) analyses.set(analysis.recordId, hash(analysis))

  const films = new Map<string, string>()
  for (const film of state.customFilms) films.set(film.id, hash(film))

  const feedback = new Map<string, string>()
  for (const [key, value] of Object.entries(state.feedback)) {
    if (value) feedback.set(feedbackKey('dimension', key), hash(value))
  }
  for (const [key, value] of Object.entries(state.timelineFeedback)) {
    if (value) feedback.set(feedbackKey('timeline', key), hash(value))
  }

  return {
    notes,
    analyses,
    films,
    feedback,
    corrections: new Set(state.corrections.map((item) => item.id)),
    yearbook: new Set(state.yearbookGenerations),
    snapshots: new Set(state.tasteSnapshots.map((item) => item.snapshot_id)),
    events: new Set(state.profileHistory.map((item) => item.id)),
    observationFeedback: new Set(state.observationFeedback.map((item) => item.feedback_id)),
    agentObservations: new Set(
      state.agentObservations.map((item) => item.observation.observation_id),
    ),
    allowAi: state.settings.allowAiNotes,
  }
}

export const diffState = (
  state: AppState,
  shadow: Shadow,
  films: Film[],
): { ops: QueueOp[]; next: Shadow } => {
  const ops: QueueOp[] = []
  const byId = new Map(films.map((film) => [film.id, film]))

  for (const record of state.records) {
    const fingerprint = hash(record)
    if (shadow.notes.get(record.id) !== fingerprint) {
      ops.push({
        type: 'note.upsert',
        note: record,
        ...(byId.has(record.filmId) ? { film: byId.get(record.filmId) } : {}),
      })
    }
  }
  for (const id of shadow.notes.keys()) {
    if (!state.records.some((record) => record.id === id)) {
      ops.push({ type: 'note.delete', noteId: id })
    }
  }

  for (const analysis of state.analyses) {
    if (shadow.analyses.get(analysis.recordId) !== hash(analysis)) {
      ops.push({ type: 'analysis.upsert', analysis })
    }
  }
  for (const recordId of shadow.analyses.keys()) {
    if (!state.analyses.some((analysis) => analysis.recordId === recordId)) {
      ops.push({ type: 'analysis.delete', noteId: recordId })
    }
  }

  for (const film of state.customFilms) {
    if (shadow.films.get(film.id) !== hash(film)) {
      ops.push({ type: 'film.upsert', film })
    }
  }

  for (const [key, value] of Object.entries(state.feedback)) {
    if (!value) continue
    const id = feedbackKey('dimension', key)
    if (shadow.feedback.get(id) !== hash(value)) {
      ops.push({
        type: 'feedback.upsert',
        scope: 'dimension',
        key,
        verdict: value.verdict,
        ...(value.correction ? { correction: value.correction } : {}),
        updatedAt: value.updatedAt,
      })
    }
  }
  for (const [key, value] of Object.entries(state.timelineFeedback)) {
    if (!value) continue
    const id = feedbackKey('timeline', key)
    if (shadow.feedback.get(id) !== hash(value)) {
      ops.push({
        type: 'feedback.upsert',
        scope: 'timeline',
        key,
        verdict: value.verdict,
        ...(value.correction ? { correction: value.correction } : {}),
        updatedAt: value.updatedAt,
      })
    }
  }

  for (const correction of state.corrections) {
    if (!shadow.corrections.has(correction.id)) {
      ops.push({ type: 'correction.insert', correction })
    }
  }
  for (const year of state.yearbookGenerations) {
    const value = Number(year)
    if (Number.isFinite(value) && !shadow.yearbook.has(year)) {
      ops.push({ type: 'yearbook.upsert', year: value, at: new Date().toISOString() })
    }
  }
  for (const snapshot of state.tasteSnapshots) {
    if (!shadow.snapshots.has(snapshot.snapshot_id)) {
      ops.push({ type: 'snapshot.insert', snapshot })
    }
  }
  for (const event of state.profileHistory) {
    if (!shadow.events.has(event.id)) {
      ops.push({ type: 'event.insert', event })
    }
  }
  for (const feedback of state.observationFeedback) {
    if (!shadow.observationFeedback.has(feedback.feedback_id)) {
      ops.push({ type: 'observationFeedback.insert', feedback })
    }
  }
  for (const bundle of state.agentObservations) {
    const id = bundle.observation.observation_id
    if (!shadow.agentObservations.has(id)) {
      ops.push({ type: 'agentObservation.insert', bundle })
    }
  }
  if (shadow.allowAi !== state.settings.allowAiNotes) {
    ops.push({ type: 'profile.allowAi', allow: state.settings.allowAiNotes })
  }

  return { ops, next: shadowFromState(state) }
}

/** First upload of local data into an empty account. */
export const bootstrapOps = (state: AppState, films: Film[]): QueueOp[] => {
  const ops: QueueOp[] = []
  const byId = new Map(films.map((film) => [film.id, film]))

  for (const film of state.customFilms) ops.push({ type: 'film.upsert', film })
  for (const record of state.records) {
    ops.push({
      type: 'note.upsert',
      note: record,
      ...(byId.has(record.filmId) ? { film: byId.get(record.filmId) } : {}),
    })
  }
  for (const analysis of state.analyses) ops.push({ type: 'analysis.upsert', analysis })

  for (const [key, value] of Object.entries(state.feedback)) {
    if (!value) continue
    ops.push({
      type: 'feedback.upsert',
      scope: 'dimension',
      key,
      verdict: value.verdict,
      ...(value.correction ? { correction: value.correction } : {}),
      updatedAt: value.updatedAt,
    })
  }
  for (const [key, value] of Object.entries(state.timelineFeedback)) {
    if (!value) continue
    ops.push({
      type: 'feedback.upsert',
      scope: 'timeline',
      key,
      verdict: value.verdict,
      ...(value.correction ? { correction: value.correction } : {}),
      updatedAt: value.updatedAt,
    })
  }
  for (const correction of state.corrections) ops.push({ type: 'correction.insert', correction })
  for (const year of state.yearbookGenerations) {
    const value = Number(year)
    if (Number.isFinite(value)) {
      ops.push({ type: 'yearbook.upsert', year: value, at: new Date().toISOString() })
    }
  }
  for (const snapshot of state.tasteSnapshots) ops.push({ type: 'snapshot.insert', snapshot })
  for (const event of state.profileHistory) ops.push({ type: 'event.insert', event })
  for (const feedback of state.observationFeedback) {
    ops.push({ type: 'observationFeedback.insert', feedback })
  }
  for (const bundle of state.agentObservations) {
    ops.push({ type: 'agentObservation.insert', bundle })
  }
  ops.push({ type: 'profile.allowAi', allow: state.settings.allowAiNotes })

  return ops
}
