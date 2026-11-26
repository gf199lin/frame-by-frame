import type { AppState, Film } from '@/types'
import { computeEvolution } from './evolution'
import { sha256Hex } from './evolutionImport'

export type AgentRunInput = {
  schema_version: 'taste-evolution-input.v1'
  run_id: string
  record_id: string
  film_id: string
  film: { title: string; titleZh: string; year: number }
  note: string
  note_sha256: string
  rating: number
  felt_like: string
  analysis: unknown
  history: {
    records: unknown[]
    observations: unknown[]
    feedback: unknown[]
    snapshots: unknown[]
  }
}

/**
 * Builds the exact payload a cross-record run needs. Feedback (including the
 * user's rejection comment) is included so the next run cannot silently ignore
 * a correction the user already made.
 */
export const buildAgentInput = async (
  state: AppState,
  films: Film[],
  recordId: string,
  runId: string,
): Promise<AgentRunInput | null> => {
  const record = state.records.find((item) => item.id === recordId)
  if (!record) return null
  const film = films.find((item) => item.id === record.filmId)
  if (!film) return null
  const evolution = computeEvolution(state, films)
  const analysis = state.analyses.find((item) => item.recordId === recordId) ?? null

  const historyRecords = state.records
    .filter((item) => item.id !== recordId)
    .slice(0, 20)
    .map(async (item) => {
      const otherFilm = films.find((candidate) => candidate.id === item.filmId)
      return {
        record_id: item.id,
        film_id: item.filmId,
        title: otherFilm?.title ?? '',
        year: otherFilm?.year ?? null,
        rating: item.rating,
        felt_like: item.feltLike ?? '',
        note: item.reflection,
        note_sha256: await sha256Hex(item.reflection),
      }
    })

  return {
    schema_version: 'taste-evolution-input.v1',
    run_id: runId,
    record_id: record.id,
    film_id: record.filmId,
    film: { title: film.title, titleZh: film.titleZh, year: film.year },
    note: record.reflection,
    note_sha256: await sha256Hex(record.reflection),
    rating: record.rating,
    felt_like: record.feltLike ?? '',
    analysis,
    history: {
      records: await Promise.all(historyRecords),
      observations: evolution.observations.map((item) => ({
        observation_id: item.observation_id,
        dimension: item.dimension,
        title: item.title,
        description: item.description,
        current_stage: item.current_stage,
        confidence: item.confidence,
        effective: item.effective,
        supporting_evidence_ids: item.supporting_evidence_ids,
        contradicting_evidence_ids: item.contradicting_evidence_ids,
        latest_feedback: item.latest_feedback ?? null,
        unverified_evidence_count: item.unverified_evidence_count,
      })),
      feedback: state.observationFeedback,
      snapshots: [...state.tasteSnapshots]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    },
  }
}
