import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { FILMS } from '@/data/films'
import type { AIFilmAnalysis, AIAgentProvenance, DimensionKey } from '@/types'
import {
  AGENT_RUN_SCHEMA_VERSION,
  normaliseProviderId,
  type AgentAnalysisV2,
  type AgentEvidenceV2,
  type AgentRunV2,
  type KbCitationV2,
  type RunNormalisation,
  type RunStatus,
  type SkillUsageV2,
} from './contractV2'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

const stringList = (value: unknown, max = 12): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, max)
    : []

const DIMENSION_KEYS = new Set<string>(DIMENSIONS.map((dimension) => dimension.key))
const DIRECTIONS = new Set(['low', 'high', 'neutral', 'ambivalent'])
const STATUSES = new Set<RunStatus>(['queued', 'running', 'succeeded', 'failed'])
const MOOD_IDS = new Set<string>(Object.keys(MOODS))
const THEME_IDS = new Set<string>(Object.keys(THEMES))
const FILM_IDS = new Set<string>(FILMS.map((film) => film.id))

/** A P0/P1 artefact or a real v2 run — both must be readable. */
export const isAgentRunV2 = (value: unknown): boolean => {
  if (!isObject(value)) return false
  if (value.schema_version === AGENT_RUN_SCHEMA_VERSION) return true
  // P0 artefacts predate schema_version but already carry these keys.
  return (
    typeof value.run_id === 'string' &&
    (typeof value.record_id === 'string' || typeof value.input === 'object') &&
    Array.isArray(value.preference_evidence)
  )
}

const normaliseEvidence = (value: unknown): AgentEvidenceV2[] => {
  if (!Array.isArray(value)) return []
  const out: AgentEvidenceV2[] = []
  for (const item of value) {
    if (!isObject(item)) continue
    const dimensionId = item.dimension_id
    // Unknown dimensions cannot be rendered on the six-axis radar. Keep the
    // rest of the evidence set instead of failing the whole run.
    if (typeof dimensionId !== 'string' || !DIMENSION_KEYS.has(dimensionId)) continue
    const rawDirection = typeof item.direction === 'string' ? item.direction : ''
    const knownDirection = DIRECTIONS.has(rawDirection)
    // An unknown direction must not silently become "neutral" (that would
    // pretend the axis was observed). Keep the claim and the raw value.
    const direction = knownDirection
      ? (rawDirection as AgentEvidenceV2['direction'])
      : 'neutral'
    const evidence = typeof item.evidence === 'string' && item.evidence.trim()
      ? item.evidence
      : undefined
    const interpretation =
      typeof item.interpretation === 'string' && item.interpretation.trim()
        ? item.interpretation
        : undefined
    out.push({
      dimension_id: dimensionId as DimensionKey,
      direction,
      strength: num(item.strength, 0),
      confidence: num(item.confidence, 0),
      ...(evidence ? { evidence } : {}),
      // Never drop the agent's reasoning when only `interpretation` exists.
      ...(!evidence && interpretation ? { evidence: interpretation } : {}),
      ...(interpretation ? { interpretation } : {}),
      ...(typeof item.quote === 'string' ? { quote: item.quote } : {}),
      ...(typeof item.evidence_type === 'string' ? { evidence_type: item.evidence_type } : {}),
      ...(!knownDirection && rawDirection ? { raw_direction: rawDirection } : {}),
      ...(item.userStatus === 'kept' || item.userStatus === 'removed'
        ? { userStatus: item.userStatus }
        : {}),
    })
  }
  return out
}

const normaliseSkills = (value: unknown): SkillUsageV2[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isObject)
    .map((item) => ({
      name: str(item.name, 'unknown'),
      invoked: item.invoked !== false,
      via: str(item.via, 'unknown'),
      ...(typeof item.version === 'string' ? { version: item.version } : {}),
      ...(typeof item.script === 'string' ? { script: item.script } : {}),
    }))
}

const normaliseCitations = (value: unknown): KbCitationV2[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isObject)
    .filter((item) => typeof item.kb_id === 'string')
    .map((item) => ({
      kb_id: item.kb_id as string,
      ...(typeof item.title === 'string' ? { title: item.title } : {}),
      ...(typeof item.source === 'string' ? { source: item.source } : {}),
      ...(typeof item.excerpt === 'string' ? { excerpt: item.excerpt } : {}),
      ...(typeof item.why_relevant === 'string' ? { why_relevant: item.why_relevant } : {}),
    }))
}

type AnalysisIssues = {
  unknownMoods: number
  unknownThemes: number
  unknownFilms: number
}

const collectEmotions = (
  value: unknown,
): { items: AgentAnalysisV2['observed_emotions']; dropped: number } => {
  if (!Array.isArray(value)) return { items: [], dropped: 0 }
  const items = value.filter(
    (item): item is AgentAnalysisV2['observed_emotions'][number] =>
      isObject(item) &&
      typeof item.mood === 'string' &&
      MOOD_IDS.has(item.mood) &&
      typeof item.evidence === 'string',
  )
  return { items, dropped: value.length - items.length }
}

const collectThemes = (
  value: unknown,
): { items: AgentAnalysisV2['themes_identified']; dropped: number } => {
  if (!Array.isArray(value)) return { items: [], dropped: 0 }
  const items = value.filter(
    (item): item is AgentAnalysisV2['themes_identified'][number] =>
      isObject(item) &&
      typeof item.theme === 'string' &&
      THEME_IDS.has(item.theme) &&
      typeof item.evidence === 'string',
  )
  return { items, dropped: value.length - items.length }
}

const collectRelatedFilms = (
  value: unknown,
): { items: NonNullable<AgentAnalysisV2['related_films']>; dropped: number } => {
  if (!Array.isArray(value)) return { items: [], dropped: 0 }
  const items = value.filter(
    (item): item is NonNullable<AgentAnalysisV2['related_films']>[number] =>
      isObject(item) &&
      typeof item.film_id === 'string' &&
      FILM_IDS.has(item.film_id) &&
      typeof item.relationship === 'string' &&
      typeof item.explanation === 'string',
  )
  return { items, dropped: value.length - items.length }
}

const normaliseAnalysis = (
  raw: unknown,
  fallbackUncertainties: unknown,
): { analysis: AgentAnalysisV2; issues: AnalysisIssues } => {
  const analysis = isObject(raw) ? raw : {}
  const focusRaw = isObject(analysis.focus) ? analysis.focus : null
  const focus = focusRaw
    ? {
        narrative: stringList(focusRaw.narrative),
        character: stringList(focusRaw.character),
        visual: stringList(focusRaw.visual),
      }
    : undefined
  const emotions = collectEmotions(analysis.observed_emotions)
  const themes = collectThemes(analysis.themes_identified)
  const related = collectRelatedFilms(analysis.related_films)
  return {
    analysis: {
      summary: str(analysis.summary),
      // Unknown ids are dropped before they can reach the radar or the profile.
      observed_emotions: emotions.items,
      themes_identified: themes.items,
      ...(focus ? { focus } : {}),
      narrative_observations: stringList(analysis.narrative_observations),
      character_observations: stringList(analysis.character_observations),
      visual_observations: stringList(analysis.visual_observations),
      liked: stringList(analysis.liked, 5),
      disliked: stringList(analysis.disliked, 5),
      uncertainties: Array.isArray(analysis.uncertainties)
        ? stringList(analysis.uncertainties, 5)
        : stringList(fallbackUncertainties, 5),
      confidence: num(analysis.confidence, 0),
      related_films: related.items,
    },
    issues: {
      unknownMoods: emotions.dropped,
      unknownThemes: themes.dropped,
      unknownFilms: related.dropped,
    },
  }
}

/**
 * Read any artefact this project has produced (P0, P1, or a real v2 run) into
 * the neutral v2 contract. Never fills in a provider that was not recorded.
 */
export const normaliseAgentRunV2 = (value: unknown): RunNormalisation => {
  if (!isObject(value)) return { ok: false, errors: ['run must be an object'] }
  const raw = value
  const errors: string[] = []

  const runId = str(raw.run_id)
  if (!runId) errors.push('run_id is missing')

  const input = isObject(raw.input) ? raw.input : {}
  const recordId =
    str(raw.record_id) || str(raw.recordId) || str(input.record_id)
  if (!recordId) errors.push('record_id is missing')

  const filmRaw = isObject(input.film) ? input.film : isObject(raw.film) ? raw.film : {}
  const filmId = str(filmRaw.id) || str(raw.film_id) || str(raw.filmId)

  if (errors.length) return { ok: false, errors }

  const statusRaw = str(raw.status, 'succeeded')
  const status: RunStatus = STATUSES.has(statusRaw as RunStatus)
    ? (statusRaw as RunStatus)
    : 'succeeded'

  const provider = normaliseProviderId(
    raw.provider ?? (typeof raw.platform === 'string' && raw.platform === 'DeepWorks' ? 'local-engine' : undefined),
  )

  const qualityRaw = isObject(raw.quality_gates) ? raw.quality_gates : {}
  const qualityGates: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(qualityRaw)) {
    const normalised = bool(item)
    if (normalised !== null) qualityGates[key] = normalised
  }

  const errorRaw = isObject(raw.error) ? raw.error : null
  const analysisResult = normaliseAnalysis(raw.analysis, raw.uncertainties)
  // Record filtering in the gates so a consumer can tell "nothing was dropped"
  // from "unknown ids were removed".
  if (analysisResult.issues.unknownMoods > 0) qualityGates.unknown_moods_filtered = false
  if (analysisResult.issues.unknownThemes > 0) qualityGates.unknown_themes_filtered = false
  if (analysisResult.issues.unknownFilms > 0) qualityGates.unknown_films_filtered = false

  const known = new Set([
    'schema_version', 'request_id', 'record_id', 'run_id', 'status', 'provider',
    'agent_id', 'agent_version', 'workflow_version', 'skills_used', 'kb_citations',
    'analysis', 'preference_evidence', 'profile_delta', 'profile_version',
    'quality_gates', 'started_at', 'completed_at', 'error', 'input', 'film_id',
    'model', 'platform', 'timestamp', 'uncertainties', 'agent', 'kb_status',
    'retrieval_log', 'micro_analysis', 'events',
  ])
  const extensions: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(raw)) {
    if (!known.has(key)) extensions[key] = item
  }

  const result: AgentRunV2 = {
    schema_version: AGENT_RUN_SCHEMA_VERSION,
    request_id: str(raw.request_id, runId),
    record_id: recordId,
    run_id: runId,
    status,
    provider,
    agent_id: str(raw.agent_id, 'unknown'),
    agent_version: str(raw.agent_version, 'unknown'),
    workflow_version: str(raw.workflow_version, 'unknown'),
    skills_used: normaliseSkills(raw.skills_used),
    kb_citations: normaliseCitations(raw.kb_citations),
    analysis: analysisResult.analysis,
    preference_evidence: normaliseEvidence(raw.preference_evidence),
    profile_delta: isObject(raw.profile_delta) ? raw.profile_delta : null,
    profile_version: typeof raw.profile_version === 'string' ? raw.profile_version : null,
    quality_gates: qualityGates,
    started_at: typeof raw.started_at === 'string' ? raw.started_at : null,
    completed_at:
      typeof raw.completed_at === 'string'
        ? raw.completed_at
        : typeof raw.timestamp === 'string'
          ? raw.timestamp
          : null,
    error: errorRaw
      ? {
          code: str(errorRaw.code, 'UNKNOWN'),
          message: str(errorRaw.message),
          ...(typeof errorRaw.retryable === 'boolean' ? { retryable: errorRaw.retryable } : {}),
        }
      : null,
    film_id: filmId || null,
    ...(typeof raw.model === 'string' ? { model: raw.model } : {}),
    ...(typeof raw.platform === 'string' ? { platform: raw.platform } : {}),
    ...(Object.keys(extensions).length ? { extensions } : {}),
  }

  return { ok: true, value: result }
}

/** Remove the note body and any nested input before persisting provenance. */
export const sanitiseRunForStorage = (run: AgentRunV2): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...run }
  delete rest.input
  return rest
}

const toProvenance = (run: AgentRunV2): AIAgentProvenance => ({
  provider: run.provider,
  request_id: run.request_id,
  run_id: run.run_id,
  agent_id: run.agent_id,
  agent_version: run.agent_version,
  workflow_version: run.workflow_version,
  ...(run.profile_version ? { profile_version: run.profile_version } : {}),
  skills_used: run.skills_used,
  kb_citations: run.kb_citations,
  quality_gates: run.quality_gates,
  raw: sanitiseRunForStorage(run),
})

export class MissingRecordIdError extends Error {
  constructor() {
    super('agent run has no record_id and cannot be attached to a watch record')
    this.name = 'MissingRecordIdError'
  }
}

/**
 * Convert a run into the website's persisted analysis shape.
 * `ambivalent` becomes `neutral` for the radar but is kept in `raw_direction`.
 */
export const agentRunToAnalysis = (run: AgentRunV2): AIFilmAnalysis => {
  if (!run.record_id) throw new MissingRecordIdError()
  const filmId = run.film_id ?? ''
  const analyzedAt = run.completed_at ?? run.started_at ?? ''
  const focus = run.analysis.focus

  return {
    schemaVersion: 1,
    recordId: run.record_id,
    filmId,
    status: 'complete',
    summary: run.analysis.summary,
    observed_emotions: run.analysis.observed_emotions,
    themes_identified: run.analysis.themes_identified,
    narrative_observations: focus?.narrative ?? run.analysis.narrative_observations ?? [],
    character_observations: focus?.character ?? run.analysis.character_observations ?? [],
    visual_observations: focus?.visual ?? run.analysis.visual_observations ?? [],
    liked: run.analysis.liked,
    disliked: run.analysis.disliked,
    preference_evidence: run.preference_evidence.map((item) => ({
      dimension_id: item.dimension_id,
      direction:
        item.direction === 'ambivalent' ? 'neutral' : (item.direction as 'low' | 'high' | 'neutral'),
      strength: item.strength,
      confidence: item.confidence,
      evidence: item.evidence ?? item.interpretation ?? '',
      ...(item.quote ? { quote: item.quote } : {}),
      ...(item.direction === 'ambivalent' ? { raw_direction: 'ambivalent' as const } : {}),
      ...(item.userStatus ? { userStatus: item.userStatus } : {}),
    })),
    uncertainties: run.analysis.uncertainties ?? [],
    confidence: run.analysis.confidence,
    related_films: (run.analysis.related_films ?? []).map((item) => ({
      filmId: item.film_id,
      relationship: item.relationship,
      explanation: item.explanation,
    })),
    model: {
      provider: run.provider,
      model: run.model ?? 'unknown',
      promptVersion: run.agent_version,
      // Never overwrite a recorded timestamp with "now".
      analyzedAt,
    },
    agent: toProvenance(run),
    review: { verdict: 'unreviewed', updatedAt: analyzedAt },
  }
}

/** Convenience: run → analysis, or null when the run cannot be attached. */
export const runV2ToAnalysis = (value: unknown): AIFilmAnalysis | null => {
  const normalised = normaliseAgentRunV2(value)
  if (!normalised.ok) return null
  try {
    return agentRunToAnalysis(normalised.value)
  } catch {
    return null
  }
}

export type { AgentRunV2, AgentEvidenceV2, AgentAnalysisV2 }
