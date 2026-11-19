import type {
  AIFilmAnalysis,
  Film,
  TasteDirection,
  TasteEvolutionSnapshot,
  WatchRecord,
} from '@/types'

/**
 * Row shapes for the tables created in supabase/migrations/0001_schema.sql.
 * `any` is avoided at the boundary: every row that leaves this module is
 * converted by map.ts into a domain type the UI already understands.
 */

export type NoteRow = {
  id: string
  user_id: string
  film_key: string
  film_snapshot: Record<string, unknown> | null
  rating: number | string
  watched_at: string
  status: string
  reflection: string
  felt_like_tags: string[] | null
  themes: string[] | null
  moods: string[] | null
  ai_summary: string
  ai_extracted_from: string
  ai_confidence: number | string
  source: string
  is_demo: boolean
  revision: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type FilmRow = {
  user_id: string
  film_key: string
  payload: Film
  created_at: string
  updated_at: string
}

export type AnalysisRow = {
  id: string
  user_id: string
  note_id: string
  schema_version: string
  status: string
  provider: string
  agent_id: string
  run: AIFilmAnalysis
  note_sha256: string | null
  created_at: string
  updated_at: string
}

export type SnapshotRow = {
  snapshot_id: string
  user_id: string
  signature: string
  run_id: string | null
  record_count: number
  overall_confidence: number | string
  observations: TasteEvolutionSnapshot['observations']
  dimensions: TasteEvolutionSnapshot['dimensions']
  changes: TasteEvolutionSnapshot['changes']
  corrections_applied: string[]
  created_at: string
  imported_at: string
}

export type EventRow = {
  id: string
  user_id: string
  kind: string
  note_id: string | null
  film_title: string | null
  film_count: number
  accepted_count: number
  changes: unknown[]
  reason: string
  occurred_at: string
  created_at: string
}

export type FeedbackRow = {
  user_id: string
  scope: 'dimension' | 'timeline'
  key: string
  verdict: 'agree' | 'not-quite' | 'corrected'
  correction: string | null
  updated_at: string
}

export type CorrectionRow = {
  id: string
  user_id: string
  scope: string
  body: string
  created_at: string
}

export type YearbookRow = {
  user_id: string
  year: number
  generated_at: string
}

export type ObservationFeedbackRow = {
  feedback_id: string
  user_id: string
  observation_id: string
  decision: string
  user_comment: string | null
  affected_snapshot_id: string
  created_at: string
}

export type AgentObservationRow = {
  observation_id: string
  user_id: string
  run_id: string
  note_id: string
  film_id: string
  note_sha256: string
  analyzed_at: string
  observation: unknown
  evidence: unknown[]
  imported_at: string
}

export type ProfileRow = {
  id: string
  email: string
  display_name: string
  allow_ai_notes: boolean
}

/** Everything a logged-in browser needs to rebuild AppState. */
export type RemoteData = {
  notes: NoteRow[]
  films: FilmRow[]
  analyses: AnalysisRow[]
  snapshots: SnapshotRow[]
  events: EventRow[]
  feedback: FeedbackRow[]
  corrections: CorrectionRow[]
  yearbook: YearbookRow[]
  observationFeedback: ObservationFeedbackRow[]
  agentObservations: AgentObservationRow[]
  profile: ProfileRow | null
  /** True when the account has no notes, films or snapshots yet. */
  isEmpty: boolean
}

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'error'

export type TasteVerdict = 'agree' | 'not-quite' | 'corrected'

export type Direction = TasteDirection

export type NoteWrite = { note: WatchRecord; film: Film | undefined }
