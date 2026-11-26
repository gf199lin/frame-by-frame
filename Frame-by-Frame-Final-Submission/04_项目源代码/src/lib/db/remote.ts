import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIFilmAnalysis,
  AgentObservationBundle,
  Film,
  TasteEvolutionSnapshot,
  TasteObservationFeedback,
  TasteProfileEvent,
  WatchRecord,
} from '@/types'
import type {
  AgentObservationRow,
  AnalysisRow,
  CorrectionRow,
  EventRow,
  FeedbackRow,
  FilmRow,
  NoteRow,
  ObservationFeedbackRow,
  ProfileRow,
  RemoteData,
  SnapshotRow,
  YearbookRow,
} from './rows'
import {
  agentObservationToRow,
  analysisToRow,
  correctionToRow,
  eventToRow,
  feedbackToRow,
  filmToRow,
  noteToRow,
  observationFeedbackToRow,
  snapshotToRow,
} from './map'

export type WriteResult = { error: string | null; retryable?: boolean }

const describe = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '')
    const code = String((error as { code?: unknown }).code ?? '')
    return code ? `${code}: ${message}` : message
  }
  return String(error)
}

const isNetworkFailure = (message: string): boolean =>
  /failed to fetch|networkerror|load failed|timeout|timed out|econnrefused|fetch failed/i.test(
    message,
  )

const result = (error: unknown): WriteResult => {
  if (!error) return { error: null }
  const message = describe(error)
  return { error: message, retryable: isNetworkFailure(message) }
}

const maybeSingleRow = <T>(data: T | T[] | null): T | null => {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

export const fetchRemote = async (
  client: SupabaseClient,
  userId: string,
): Promise<RemoteData> => {
  const [notes, films, analyses, snapshots, events, feedback, corrections, yearbook, obsFeedback, agentObservations, profile] =
    await Promise.all([
      client.from('watch_notes').select('*').is('deleted_at', null).order('watched_at', { ascending: false }),
      client.from('user_films').select('*'),
      client.from('note_analyses').select('*'),
      client.from('taste_snapshots').select('*').order('created_at', { ascending: false }),
      client.from('taste_events').select('*').order('occurred_at', { ascending: false }).limit(80),
      client.from('taste_feedback').select('*'),
      client.from('user_corrections').select('*').order('created_at', { ascending: false }),
      client.from('yearbook_generations').select('*'),
      client
        .from('taste_observation_feedback')
        .select('*')
        .order('created_at', { ascending: false }),
      client.from('agent_observations').select('*').order('analyzed_at', { ascending: false }),
      client
        .from('profiles')
        .select('id,email,display_name,allow_ai_notes')
        .eq('id', userId)
        .maybeSingle(),
    ])

  const firstError = [
    notes,
    films,
    analyses,
    snapshots,
    events,
    feedback,
    corrections,
    yearbook,
    obsFeedback,
    agentObservations,
    profile,
  ].find((response) => response.error)?.error

  if (firstError) throw new Error(describe(firstError))

  const noteRows = (notes.data ?? []) as NoteRow[]
  const filmRows = (films.data ?? []) as FilmRow[]
  const snapshotRows = (snapshots.data ?? []) as SnapshotRow[]

  return {
    notes: noteRows,
    films: filmRows,
    analyses: (analyses.data ?? []) as AnalysisRow[],
    snapshots: snapshotRows,
    events: (events.data ?? []) as EventRow[],
    feedback: (feedback.data ?? []) as FeedbackRow[],
    corrections: (corrections.data ?? []) as CorrectionRow[],
    yearbook: (yearbook.data ?? []) as YearbookRow[],
    observationFeedback: (obsFeedback.data ?? []) as ObservationFeedbackRow[],
    agentObservations: (agentObservations.data ?? []) as AgentObservationRow[],
    profile: maybeSingleRow(profile.data as ProfileRow | ProfileRow[] | null),
    isEmpty: noteRows.length === 0 && filmRows.length === 0,
  }
}

export const writeNote = async (
  client: SupabaseClient,
  userId: string,
  note: WatchRecord,
  film: Film | undefined,
): Promise<WriteResult> => {
  const { error } = await client
    .from('watch_notes')
    .upsert(noteToRow(note, userId, film), { onConflict: 'id' })
  return result(error)
}

export const softDeleteNote = async (
  client: SupabaseClient,
  noteId: string,
): Promise<WriteResult> => {
  const { error } = await client
    .from('watch_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
  return result(error)
}

export const writeAnalysis = async (
  client: SupabaseClient,
  userId: string,
  analysis: AIFilmAnalysis,
): Promise<WriteResult> => {
  // A note can be re-keyed when the user edits it. Delete the row that was
  // attached to this note id first so no orphan analysis survives.
  const removed = await client.from('note_analyses').delete().eq('note_id', analysis.recordId)
  if (removed.error) return result(removed.error)

  const { error } = await client
    .from('note_analyses')
    .insert(analysisToRow(analysis, userId))
  return result(error)
}

export const deleteAnalysis = async (
  client: SupabaseClient,
  noteId: string,
): Promise<WriteResult> => {
  const { error } = await client.from('note_analyses').delete().eq('note_id', noteId)
  return result(error)
}

export const writeFilm = async (
  client: SupabaseClient,
  userId: string,
  film: Film,
): Promise<WriteResult> => {
  const { error } = await client
    .from('user_films')
    .upsert(filmToRow(film, userId), { onConflict: 'user_id,film_key' })
  return result(error)
}

export const writeFeedback = async (
  client: SupabaseClient,
  userId: string,
  scope: 'dimension' | 'timeline',
  key: string,
  verdict: 'agree' | 'not-quite' | 'corrected',
  correction: string | undefined,
  updatedAt: string,
): Promise<WriteResult> => {
  const { error } = await client
    .from('taste_feedback')
    .upsert(feedbackToRow(scope, key, verdict, correction, updatedAt, userId), {
      onConflict: 'user_id,scope,key',
    })
  return result(error)
}

export const insertCorrection = async (
  client: SupabaseClient,
  userId: string,
  correction: { id: string; scope: string; text: string; createdAt: string },
): Promise<WriteResult> => {
  const { error } = await client
    .from('user_corrections')
    .upsert(correctionToRow(correction, userId), { onConflict: 'id', ignoreDuplicates: true })
  return result(error)
}

export const writeYearbook = async (
  client: SupabaseClient,
  userId: string,
  year: number,
  generatedAt: string,
): Promise<WriteResult> => {
  const { error } = await client
    .from('yearbook_generations')
    .upsert(
      { user_id: userId, year, generated_at: generatedAt },
      { onConflict: 'user_id,year' },
    )
  return result(error)
}

export const insertSnapshot = async (
  client: SupabaseClient,
  userId: string,
  snapshot: TasteEvolutionSnapshot,
): Promise<WriteResult> => {
  const { error } = await client
    .from('taste_snapshots')
    .upsert(snapshotToRow(snapshot, userId), {
      onConflict: 'snapshot_id',
      ignoreDuplicates: true,
    })
  return result(error)
}

export const insertEvent = async (
  client: SupabaseClient,
  userId: string,
  event: TasteProfileEvent,
): Promise<WriteResult> => {
  const { error } = await client
    .from('taste_events')
    .upsert(eventToRow(event, userId), { onConflict: 'id', ignoreDuplicates: true })
  return result(error)
}

export const insertObservationFeedback = async (
  client: SupabaseClient,
  userId: string,
  feedback: TasteObservationFeedback,
): Promise<WriteResult> => {
  const { error } = await client
    .from('taste_observation_feedback')
    .upsert(observationFeedbackToRow(feedback, userId), {
      onConflict: 'feedback_id',
      ignoreDuplicates: true,
    })
  return result(error)
}

export const insertAgentObservation = async (
  client: SupabaseClient,
  userId: string,
  bundle: AgentObservationBundle,
): Promise<WriteResult> => {
  const { error } = await client
    .from('agent_observations')
    .upsert(agentObservationToRow(bundle, userId), {
      onConflict: 'observation_id',
      ignoreDuplicates: true,
    })
  return result(error)
}

export const writeAllowAi = async (
  client: SupabaseClient,
  userId: string,
  allow: boolean,
): Promise<WriteResult> => {
  const { error } = await client
    .from('profiles')
    .update({ allow_ai_notes: allow })
    .eq('id', userId)
  return result(error)
}
