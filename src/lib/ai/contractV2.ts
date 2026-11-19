import type { DimensionKey, MoodId, ThemeId } from '@/types'

/**
 * Platform-neutral analysis contract.
 *
 * These types describe the wire format only. They must not import anything from
 * a specific model vendor or from the DeepWorks runtime: the same shapes are
 * produced by the legacy DeepSeek path today and by a future DeepWorks adapter.
 */

export const PENDING_NOTE_SCHEMA_VERSION = 1 as const
export const AGENT_RUN_SCHEMA_VERSION = 2 as const

/**
 * Where a result actually came from.
 * - `legacy-deepseek`: the existing Worker/Node DeepSeek path.
 * - `deepworks`: a real DeepWorks agent run. Never set this by hand.
 * - `local-engine`: the browser-side local analysis.
 * - `seed`: bundled demo analyses.
 * - `unknown`: provenance missing; must be shown as unknown, never guessed.
 */
export type ProviderId =
  | 'legacy-deepseek'
  | 'deepworks'
  | 'local-engine'
  | 'seed'
  | 'stub'
  | 'unknown'

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type ConsentV1 = {
  allow_ai_notes: boolean
  policy_version?: string
  accepted_at?: string
}

export type PendingFilmV1 = {
  id: string
  title: string
  titleZh?: string
  year: number
  director?: string
  genres?: string[]
  country?: string
  language?: string
  runtime?: number
  logline?: string
}

export type PendingHistoryItemV1 = {
  id: string
  title: string
  year: number
  rating: number
  director?: string
  themes: string[]
  moods: string[]
  summary?: string
}

/** Input contract: one user note, prepared by the frontend, confirmed by the gateway. */
export type PendingNoteV1 = {
  schema_version: typeof PENDING_NOTE_SCHEMA_VERSION
  request_id: string
  record_id: string
  idempotency_key: string
  /** Confirmed by the server. A client-supplied value is never trusted. */
  user_id: string
  consent: ConsentV1
  created_at: string
  film: PendingFilmV1
  rating: number
  note: string
  note_sha256: string
  watched_at?: string
  felt_like?: string[]
  history?: PendingHistoryItemV1[]
  locale?: string
}

export type AgentDirection = 'low' | 'high' | 'neutral' | 'ambivalent'

/** A single traceable claim. Both `evidence` and `interpretation` are kept. */
export type AgentEvidenceV2 = {
  dimension_id: DimensionKey
  direction: AgentDirection
  strength: number
  confidence: number
  /** Why this note supports the claim. Required by the website. */
  evidence?: string
  /** Fuller reading produced by the agent. */
  interpretation?: string
  quote?: string
  evidence_type?: string
  /** Present when the agent emitted a direction this contract does not know. */
  raw_direction?: string
  userStatus?: 'kept' | 'removed'
}

export type AgentFocusV2 = {
  narrative: string[]
  character: string[]
  visual: string[]
}

export type AgentAnalysisV2 = {
  summary: string
  observed_emotions: Array<{ mood: MoodId; evidence: string }>
  themes_identified: Array<{ theme: ThemeId; evidence: string }>
  /** v2 shape. v1 stored the same data as three sibling arrays. */
  focus?: AgentFocusV2
  narrative_observations?: string[]
  character_observations?: string[]
  visual_observations?: string[]
  liked: string[]
  disliked: string[]
  uncertainties?: string[]
  confidence: number
  related_films?: Array<{ film_id: string; relationship: string; explanation: string }>
}

export type SkillUsageV2 = {
  name: string
  invoked: boolean
  /** `skill` means a real tool call. `read` means the SKILL.md was read. */
  via: string
  version?: string
  script?: string
}

export type KbCitationV2 = {
  kb_id: string
  title?: string
  source?: string
  excerpt?: string
  why_relevant?: string
}

export type RunErrorV2 = {
  code: string
  message: string
  retryable?: boolean
}

/** Output contract: what the gateway returns and what storage persists. */
export type AgentRunV2 = {
  schema_version: typeof AGENT_RUN_SCHEMA_VERSION
  request_id: string
  record_id: string
  run_id: string
  status: RunStatus
  provider: ProviderId
  agent_id: string
  agent_version: string
  workflow_version: string
  skills_used: SkillUsageV2[]
  kb_citations: KbCitationV2[]
  analysis: AgentAnalysisV2
  preference_evidence: AgentEvidenceV2[]
  profile_delta: Record<string, unknown> | null
  profile_version: string | null
  quality_gates: Record<string, boolean>
  started_at: string | null
  completed_at: string | null
  error: RunErrorV2 | null
  /** Echo of the validated input, without the note body. */
  film_id: string | null
  model?: string
  platform?: string
  /** Anything the agent added that this contract does not know about. */
  extensions?: Record<string, unknown>
}

export type RunNormalisationFailure = {
  ok: false
  errors: string[]
}

export type RunNormalisationSuccess = {
  ok: true
  value: AgentRunV2
}

export type RunNormalisation = RunNormalisationSuccess | RunNormalisationFailure

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  'legacy-deepseek': 'Legacy DeepSeek',
  deepworks: 'DeepWorks Agent',
  'local-engine': 'Local engine',
  seed: 'Bundled demo',
  stub: 'Stub (tests)',
  unknown: 'Unknown',
}

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && value in PROVIDER_LABELS

/**
 * Map raw provider names onto the public provider ids. `deepseek` is the wire
 * name used by the existing provider; it is exposed as `legacy-deepseek` so no
 * surface can mistake it for a DeepWorks run.
 */
export const normaliseProviderId = (value: unknown): ProviderId => {
  if (value === 'deepseek' || value === 'legacy-deepseek') return 'legacy-deepseek'
  if (value === 'deepworks') return 'deepworks'
  if (value === 'local-engine') return 'local-engine'
  if (value === 'seed') return 'seed'
  if (value === 'stub') return 'stub'
  return 'unknown'
}
