import type { AnalysisMeta, AnalyzeResponse, ModelAnalysis } from './types.ts'

/**
 * Server-side agent-run.v2.
 *
 * This is intentionally independent of `src/lib/ai/contractV2.ts` so the
 * Worker bundle does not depend on frontend path aliases. Both files describe
 * the same wire shape and are kept in sync by tests, not by imports.
 */

export type RunStatusV2 = 'queued' | 'running' | 'succeeded' | 'failed'
export type ProviderIdV2 =
  | 'legacy-deepseek'
  | 'deepworks'
  | 'local-engine'
  | 'seed'
  | 'stub'
  | 'unknown'

export type AgentRunV2 = {
  schema_version: 2
  request_id: string
  record_id: string
  run_id: string
  status: RunStatusV2
  provider: ProviderIdV2
  agent_id: string
  agent_version: string
  workflow_version: string
  skills_used: Array<{ name: string; invoked: boolean; via: string; version?: string }>
  kb_citations: Array<{ kb_id: string; title?: string; source?: string; excerpt?: string }>
  analysis: {
    summary: string
    observed_emotions: Array<{ mood: string; evidence: string }>
    themes_identified: Array<{ theme: string; evidence: string }>
    focus: { narrative: string[]; character: string[]; visual: string[] }
    liked: string[]
    disliked: string[]
    uncertainties: string[]
    confidence: number
    related_films: Array<{ film_id: string; relationship: string; explanation: string }>
  }
  preference_evidence: Array<{
    dimension_id: string
    direction: 'low' | 'high' | 'neutral'
    strength: number
    confidence: number
    evidence: string
    quote?: string
    evidence_type: string
  }>
  profile_delta: null
  profile_version: null
  quality_gates: Record<string, boolean>
  started_at: string
  completed_at: string
  error: null
  film_id: string
  model: string
  platform: 'cloudflare-worker'
}

export type BuildAgentRunInput = {
  requestId: string
  recordId: string
  runId: string
  filmId: string
  response: AnalyzeResponse
  startedAt: string
}

const toAnalysis = (analysis: ModelAnalysis): AgentRunV2['analysis'] => ({
  summary: analysis.summary,
  observed_emotions: analysis.observed_emotions,
  themes_identified: analysis.themes_identified,
  focus: analysis.focus,
  liked: analysis.liked,
  disliked: analysis.disliked,
  uncertainties: analysis.uncertainties,
  confidence: analysis.confidence,
  related_films: analysis.related_films,
})

const toProvider = (meta: AnalysisMeta): ProviderIdV2 => {
  if (meta.providerId === 'legacy-deepseek' || meta.providerId === 'deepworks') {
    return meta.providerId
  }
  // Never infer DeepWorks from a model name or platform label.
  return 'unknown'
}

export const buildAgentRun = (input: BuildAgentRunInput): AgentRunV2 => {
  const { response } = input
  return {
    schema_version: 2,
    request_id: input.requestId,
    record_id: input.recordId,
    run_id: input.runId,
    status: 'succeeded',
    provider: toProvider(response.meta),
    agent_id: 'legacy-deepseek-pipeline',
    agent_version: response.meta.promptVersion,
    workflow_version: 'legacy-single-pass-v1',
    // No skill or knowledge base ran on this path. Empty is the honest value.
    skills_used: [],
    kb_citations: [],
    analysis: toAnalysis(response.analysis),
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
    quality_gates: {},
    started_at: input.startedAt,
    completed_at: response.meta.analyzedAt,
    error: null,
    film_id: input.filmId,
    model: response.meta.model,
    platform: 'cloudflare-worker',
  }
}

export type RunValidation = { ok: true; value: AgentRunV2 } | { ok: false; errors: string[] }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Minimal structural validation before the run leaves the Worker. It checks
 * the fields a consumer relies on, not every optional detail.
 */
export const validateAgentRunV2 = (value: unknown): RunValidation => {
  if (!isObject(value)) return { ok: false, errors: ['run must be an object'] }
  const errors: string[] = []
  if (value.schema_version !== 2) errors.push('schema_version must be 2')
  for (const key of ['request_id', 'record_id', 'run_id', 'agent_id', 'agent_version']) {
    if (typeof value[key] !== 'string' || !(value[key] as string)) errors.push(`${key} is required`)
  }
  if (!['queued', 'running', 'succeeded', 'failed'].includes(String(value.status))) {
    errors.push('status is invalid')
  }
  if (!['legacy-deepseek', 'deepworks', 'local-engine', 'seed', 'stub', 'unknown'].includes(String(value.provider))) {
    errors.push('provider is invalid')
  }
  if (!Array.isArray(value.preference_evidence)) errors.push('preference_evidence must be an array')
  if (!isObject(value.analysis)) errors.push('analysis must be an object')
  if (isObject(value.quality_gates)) {
    for (const [key, flag] of Object.entries(value.quality_gates)) {
      if (typeof flag !== 'boolean') errors.push(`quality_gates.${key} must be boolean`)
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: value as unknown as AgentRunV2 }
}
