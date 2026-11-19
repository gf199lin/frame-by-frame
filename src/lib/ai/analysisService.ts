import { analyzeFilmMemory } from './client'
import { analyzeWithFilmCurator } from './deepworksEngine'
import { normaliseAgentRunV2 } from './normaliseRunV2'
import type { AiAnalyzeRequest, AiAnalyzeResponse } from './types'
import type { DimensionKey, MoodId, ThemeId } from '@/types'
import {
  AGENT_RUN_SCHEMA_VERSION,
  type AgentDirection,
  type AgentRunV2,
  type ConsentV1,
  type KbCitationV2,
  type PendingNoteV1,
  type ProviderId,
  type RunErrorV2,
  type RunStatus,
  type SkillUsageV2,
} from './contractV2'

/**
 * Provider-neutral analysis service.
 *
 * The frontend talks to this interface only. Two providers exist:
 * - `legacy-deepseek`: the project's own Node backend calling DeepSeek.
 * - `deepworks`: the local bridge that runs the project's `film-curator`
 *   agent inside the installed DeepWorks engine. Reasoning happens in
 *   DeepWorks; the website only triggers and displays it.
 */

export type AnalysisServiceErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'BAD_REQUEST'
  | 'ANALYSIS_FAILED'
  | 'NOT_FOUND'

export class AnalysisServiceError extends Error {
  readonly code: AnalysisServiceErrorCode
  readonly provider: ProviderId
  constructor(code: AnalysisServiceErrorCode, provider: ProviderId, message: string) {
    super(message)
    this.name = 'AnalysisServiceError'
    this.code = code
    this.provider = provider
  }
}

export type AnalysisSubmission = {
  run_id: string
  request_id: string
  record_id: string
  provider: ProviderId
  status: RunStatus
}

export type AnalysisStatus = {
  run_id: string
  provider: ProviderId
  status: RunStatus | 'not_configured'
  error?: RunErrorV2
}

export type AnalysisService = {
  readonly provider: ProviderId
  submitAnalysis(input: PendingNoteV1, options?: { signal?: AbortSignal }): Promise<AnalysisSubmission>
  getAnalysisStatus(runId: string): Promise<AnalysisStatus>
  getAnalysisResult(runId: string): Promise<AgentRunV2>
}

export type AnalyseFn = (
  payload: AiAnalyzeRequest,
  options?: { signal?: AbortSignal },
) => Promise<AiAnalyzeResponse>

const newId = (prefix: string): string => {
  const random = globalThis.crypto?.randomUUID?.()
  return `${prefix}_${random ?? Math.random().toString(36).slice(2)}`
}

/** The Worker accepts the v2 identity fields alongside the legacy payload. */
type WorkerRequest = AiAnalyzeRequest & {
  record_id: string
  request_id: string
  idempotency_key: string
  /**
   * The Worker rejects (400) any note whose consent is not explicitly granted
   * on the wire. Checking consent in the browser only is not enough.
   */
  consent: ConsentV1
}

const toAiRequest = (input: PendingNoteV1): WorkerRequest => ({
  record_id: input.record_id,
  request_id: input.request_id,
  idempotency_key: input.idempotency_key,
  consent: {
    allow_ai_notes: input.consent.allow_ai_notes === true,
    ...(input.consent.policy_version ? { policy_version: input.consent.policy_version } : {}),
    ...(input.consent.accepted_at ? { accepted_at: input.consent.accepted_at } : {}),
  },
  film: {
    id: input.film.id,
    title: input.film.title,
    ...(input.film.titleZh ? { titleZh: input.film.titleZh } : {}),
    year: input.film.year,
    ...(input.film.director ? { director: input.film.director } : {}),
    ...(input.film.genres ? { genres: input.film.genres } : {}),
    ...(input.film.country ? { country: input.film.country } : {}),
    ...(input.film.language ? { language: input.film.language } : {}),
    ...(typeof input.film.runtime === 'number' ? { runtime: input.film.runtime } : {}),
    ...(input.film.logline ? { logline: input.film.logline } : {}),
  },
  rating: input.rating,
  ...(input.watched_at ? { watchedAt: input.watched_at } : {}),
  ...(input.felt_like?.length ? { feltLike: input.felt_like.join('、') } : {}),
  note: input.note,
  history: (input.history ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    rating: item.rating,
    ...(item.director ? { director: item.director } : {}),
    themes: item.themes,
    moods: item.moods,
    ...(item.summary ? { summary: item.summary } : {}),
  })),
  locale: 'zh-CN',
})

const errorOf = (error: unknown): RunErrorV2 => {
  const code = (error as { code?: unknown })?.code
  return {
    code: typeof code === 'string' ? code : 'ANALYSIS_FAILED',
    message: error instanceof Error ? error.message : 'analysis failed',
    retryable: (error as { retryable?: unknown })?.retryable === true,
  }
}

const buildSuccessRun = (
  input: PendingNoteV1,
  response: AiAnalyzeResponse,
  runId: string,
  startedAt: string,
): AgentRunV2 => ({
  schema_version: AGENT_RUN_SCHEMA_VERSION,
  request_id: input.request_id,
  record_id: input.record_id,
  run_id: runId,
  status: 'succeeded',
  // The legacy pipeline is never reported as a DeepWorks run.
  provider: 'legacy-deepseek',
  agent_id: 'legacy-deepseek-pipeline',
  agent_version: response.meta.promptVersion,
  workflow_version: 'legacy-single-pass-v1',
  skills_used: [],
  kb_citations: [],
  analysis: {
    summary: response.analysis.summary,
    observed_emotions: response.analysis.observed_emotions,
    themes_identified: response.analysis.themes_identified,
    focus: response.analysis.focus,
    narrative_observations: response.analysis.focus.narrative,
    character_observations: response.analysis.focus.character,
    visual_observations: response.analysis.focus.visual,
    liked: response.analysis.liked,
    disliked: response.analysis.disliked,
    uncertainties: response.analysis.uncertainties,
    confidence: response.analysis.confidence,
    related_films: response.analysis.related_films,
  },
  preference_evidence: response.analysis.preference_evidence.map((item) => ({
    dimension_id: item.dimension_id,
    direction: item.direction,
    strength: item.strength,
    confidence: item.confidence,
    evidence: item.evidence,
    ...(item.quote ? { quote: item.quote } : {}),
    evidence_type: 'user_quote',
  })),
  profile_delta: null,
  profile_version: null,
  // No pipeline ran these gates; empty is honest and keeps "unknown" distinct
  // from "passed".
  quality_gates: {},
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  error: null,
  film_id: input.film.id,
  model: response.meta.model,
  platform: 'cloudflare-worker',
})

const buildFailedRun = (
  input: PendingNoteV1,
  error: RunErrorV2,
  runId: string,
  startedAt: string,
): AgentRunV2 => ({
  schema_version: AGENT_RUN_SCHEMA_VERSION,
  request_id: input.request_id,
  record_id: input.record_id,
  run_id: runId,
  status: 'failed',
  provider: 'legacy-deepseek',
  agent_id: 'legacy-deepseek-pipeline',
  agent_version: 'unknown',
  workflow_version: 'legacy-single-pass-v1',
  skills_used: [],
  kb_citations: [],
  analysis: {
    summary: '',
    observed_emotions: [],
    themes_identified: [],
    liked: [],
    disliked: [],
    uncertainties: [],
    confidence: 0,
    related_films: [],
  },
  preference_evidence: [],
  profile_delta: null,
  profile_version: null,
  quality_gates: {},
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  error,
  film_id: input.film.id,
})

/**
 * The existing DeepSeek path, wrapped so callers see the same contract as any
 * future provider.
 */
export class LegacyDeepSeekAnalysisService implements AnalysisService {
  readonly provider = 'legacy-deepseek' as const
  private readonly runs = new Map<string, AgentRunV2>()
  private readonly byRequest = new Map<string, string>()
  private readonly byIdempotencyKey = new Map<string, string>()
  private readonly analyse: AnalyseFn

  constructor(analyse: AnalyseFn = analyzeFilmMemory) {
    this.analyse = analyse
  }

  private submission(run: AgentRunV2): AnalysisSubmission {
    return {
      run_id: run.run_id,
      request_id: run.request_id,
      record_id: run.record_id,
      provider: run.provider,
      status: run.status,
    }
  }

  async submitAnalysis(
    input: PendingNoteV1,
    options: { signal?: AbortSignal } = {},
  ): Promise<AnalysisSubmission> {
    if (input.consent?.allow_ai_notes !== true) {
      throw new AnalysisServiceError(
        'BAD_REQUEST',
        this.provider,
        'consent.allow_ai_notes must be true before a note can be analysed',
      )
    }

    // Same idempotency key or same request id → reuse the existing run.
    const known =
      this.byIdempotencyKey.get(input.idempotency_key) ?? this.byRequest.get(input.request_id)
    if (known) {
      const run = this.runs.get(known)
      if (run) return this.submission(run)
    }

    const runId = newId('run')
    const startedAt = new Date().toISOString()

    try {
      const response = await this.analyse(toAiRequest(input), options)
      // Reuse the Worker's run when it produced one, so request_id, run_id and
      // record_id are identical on both sides of the wire.
      const fromWorker = response.run ? normaliseAgentRunV2(response.run) : null
      const run =
        fromWorker?.ok && fromWorker.value.record_id === input.record_id
          ? fromWorker.value
          : buildSuccessRun(input, response, runId, startedAt)
      this.remember(input, run)
      return this.submission(run)
    } catch (error) {
      const run = buildFailedRun(input, errorOf(error), runId, startedAt)
      this.remember(input, run)
      return this.submission(run)
    }
  }

  private remember(input: PendingNoteV1, run: AgentRunV2): void {
    this.runs.set(run.run_id, run)
    this.byRequest.set(input.request_id, run.run_id)
    this.byIdempotencyKey.set(input.idempotency_key, run.run_id)
  }

  async getAnalysisStatus(runId: string): Promise<AnalysisStatus> {
    const run = this.runs.get(runId)
    if (!run) {
      return {
        run_id: runId,
        provider: this.provider,
        status: 'failed',
        error: { code: 'NOT_FOUND', message: 'unknown run id', retryable: false },
      }
    }
    return {
      run_id: runId,
      provider: run.provider,
      status: run.status,
      ...(run.error ? { error: run.error } : {}),
    }
  }

  async getAnalysisResult(runId: string): Promise<AgentRunV2> {
    const run = this.runs.get(runId)
    if (!run) {
      throw new AnalysisServiceError('NOT_FOUND', this.provider, `unknown run id: ${runId}`)
    }
    if (run.status === 'failed') {
      throw new AnalysisServiceError(
        'ANALYSIS_FAILED',
        this.provider,
        run.error?.message ?? 'analysis failed',
      )
    }
    return run
  }
}

/**
 * Kept for deployments where the local DeepWorks bridge is absent. It is
 * deliberately incapable of producing a result and never fabricates one.
 */
export class DeepWorksAnalysisService implements AnalysisService {
  readonly provider = 'deepworks' as const

  async submitAnalysis(): Promise<AnalysisSubmission> {
    throw new AnalysisServiceError(
      'PROVIDER_NOT_CONFIGURED',
      this.provider,
      'DeepWorks agent endpoint is not configured on this deployment.',
    )
  }

  async getAnalysisStatus(runId: string): Promise<AnalysisStatus> {
    return { run_id: runId, provider: this.provider, status: 'not_configured' }
  }

  async getAnalysisResult(): Promise<AgentRunV2> {
    throw new AnalysisServiceError(
      'PROVIDER_NOT_CONFIGURED',
      this.provider,
      'DeepWorks agent endpoint is not configured on this deployment.',
    )
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const asList = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

/**
 * Turns the agent's P0 archive into the website's neutral run contract. Every
 * provenance field is copied, not invented: `provider` is `deepworks` because
 * the DeepWorks engine really executed the agent.
 */
const buildDeepWorksRun = (
  input: PendingNoteV1,
  result: { meta: { run_id: string; model: string; agent: string; duration_ms: number }; p0: Record<string, unknown> },
  startedAt: string,
): AgentRunV2 => {
  const p0 = result.p0
  const analysis = asRecord(p0.analysis)
  const p0Input = asRecord(p0.input)
  const p0Film = asRecord(p0Input.film)
  const timestamp = typeof p0.timestamp === 'string' ? p0.timestamp : startedAt

  return {
    schema_version: AGENT_RUN_SCHEMA_VERSION,
    request_id: input.request_id,
    record_id: input.record_id,
    run_id: result.meta.run_id || String(p0.run_id ?? ''),
    status: 'succeeded',
    provider: 'deepworks',
    agent_id: String(p0.agent_id ?? 'film-curator'),
    agent_version: String(p0.agent ?? 'film-curator'),
    workflow_version: 'p0-film-curator-workflow',
    skills_used: asList<SkillUsageV2>(p0.skills_used),
    kb_citations: asList<KbCitationV2>(p0.kb_citations),
    analysis: {
      summary: String(analysis.summary ?? ''),
      observed_emotions: asList<{ mood: MoodId; evidence: string }>(analysis.observed_emotions),
      themes_identified: asList<{ theme: ThemeId; evidence: string }>(analysis.themes_identified),
      liked: asList<string>(analysis.liked),
      disliked: asList<string>(analysis.disliked),
      uncertainties: asList<string>(p0.uncertainties),
      confidence: Number(analysis.confidence ?? 0),
      related_films: [],
    },
    preference_evidence: asList<Record<string, unknown>>(p0.preference_evidence).map((item) => ({
      dimension_id: item.dimension_id as DimensionKey,
      direction: (item.direction ?? 'neutral') as AgentDirection,
      strength: Number(item.strength ?? 0),
      confidence: Number(item.confidence ?? 0),
      evidence: String(item.interpretation ?? item.evidence ?? ''),
      ...(typeof item.quote === 'string' ? { quote: item.quote } : {}),
      evidence_type: String(item.evidence_type ?? 'user_quote'),
    })),
    profile_delta: (p0.profile_delta as Record<string, unknown> | null | undefined) ?? null,
    profile_version: null,
    quality_gates: asRecord(p0.quality_gates) as Record<string, boolean>,
    started_at: timestamp,
    completed_at: timestamp,
    error: null,
    film_id: String(p0Film.id ?? input.film.id),
    model: result.meta.model,
    platform: 'DeepWorks',
    extensions: {
      kb_status: p0.kb_status ?? null,
      retrieval_log: p0.retrieval_log ?? null,
      agent_duration_ms: result.meta.duration_ms,
    },
  }
}

/** Runs the project's film-curator agent inside the installed DeepWorks engine. */
export class DeepWorksEngineAnalysisService implements AnalysisService {
  readonly provider = 'deepworks' as const
  private readonly runs = new Map<string, AgentRunV2>()

  async submitAnalysis(
    input: PendingNoteV1,
    options: { signal?: AbortSignal } = {},
  ): Promise<AnalysisSubmission> {
    if (input.consent?.allow_ai_notes !== true) {
      throw new AnalysisServiceError(
        'BAD_REQUEST',
        this.provider,
        'consent.allow_ai_notes must be true before a note can be analysed',
      )
    }

    const startedAt = new Date().toISOString()
    const result = await analyzeWithFilmCurator(toAiRequest(input), options)
    const run = buildDeepWorksRun(input, result, startedAt)
    this.runs.set(run.run_id, run)

    return {
      run_id: run.run_id,
      request_id: run.request_id,
      record_id: run.record_id,
      provider: run.provider,
      status: run.status,
    }
  }

  async getAnalysisStatus(runId: string): Promise<AnalysisStatus> {
    const run = this.runs.get(runId)
    if (!run) {
      return {
        run_id: runId,
        provider: this.provider,
        status: 'failed',
        error: { code: 'NOT_FOUND', message: 'unknown run id', retryable: false },
      }
    }
    return {
      run_id: runId,
      provider: run.provider,
      status: run.status,
      ...(run.error ? { error: run.error } : {}),
    }
  }

  async getAnalysisResult(runId: string): Promise<AgentRunV2> {
    const run = this.runs.get(runId)
    if (!run) {
      throw new AnalysisServiceError('NOT_FOUND', this.provider, `unknown run id: ${runId}`)
    }
    return run
  }
}

const rememberEnginePreference = (provider: string): void => {
  try {
    window.localStorage.setItem('fbf.engine', provider)
  } catch {
    /* storage may be unavailable */
  }
}

const readEnginePreference = (): string | undefined => {
  try {
    return window.localStorage.getItem('fbf.engine') ?? undefined
  } catch {
    return undefined
  }
}

export const setEnginePreference = rememberEnginePreference

export const createAnalysisService = (options: {
  provider?: string
  analyse?: AnalyseFn
} = {}): AnalysisService => {
  const configured =
    options.provider ??
    (import.meta.env?.VITE_AI_PROVIDER as string | undefined) ??
    (typeof window === 'undefined' ? undefined : readEnginePreference())
  if (configured === 'deepworks') {
    return new DeepWorksEngineAnalysisService()
  }
  return new LegacyDeepSeekAnalysisService(options.analyse)
}

