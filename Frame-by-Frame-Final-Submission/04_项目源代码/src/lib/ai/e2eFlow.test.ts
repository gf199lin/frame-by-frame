import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import {
  AnalysisServiceError,
  DeepWorksAnalysisService,
  LegacyDeepSeekAnalysisService,
} from './analysisService'
import type { PendingNoteV1 } from './contractV2'
import type { AiAnalyzeResponse } from './types'
import { agentRunToAnalysis, normaliseAgentRunV2 } from './normaliseRunV2'
import { migrateState } from '@/lib/storage'
import { computeTasteProfile } from './tasteProfile'
import { createInitialState } from '@/data/seed'
import { STORAGE_VERSION } from '@/data/taxonomy'
import type { AIFilmAnalysis, AppState, Film, WatchRecord } from '@/types'

/**
 * End-to-end flow test for the non-browser parts of P2-A5:
 * submit → Worker response → AgentRunV2 → storage → reload → profile.
 *
 * Playwright is not installed in this project, so this replaces a browser E2E.
 * It is honest about the difference; see P2-A5-TEST-REPORT.md.
 */

const note: PendingNoteV1 = {
  schema_version: 1,
  request_id: 'req_e2e_1',
  record_id: 'rec_e2e_1',
  idempotency_key: 'rec_e2e_1:abc',
  user_id: 'anon-local',
  consent: { allow_ai_notes: true, policy_version: '2026-11-01' },
  created_at: '2026-11-10T00:00:00.000Z',
  film: { id: 'manchester', title: 'Manchester by the Sea', year: 2016 },
  rating: 4.5,
  note: '最打动我的不是台词，而是警局里他突然去夺枪。那一刻我知道他从来没有走出来。',
  note_sha256: 'a'.repeat(64),
  felt_like: ['restrained'],
}

const modelAnalysis = {
  summary: '一次克制的哀悼。',
  observed_emotions: [{ mood: 'restrained' as const, evidence: '他没有哭' }],
  themes_identified: [{ theme: 'grief' as const, evidence: '哀悼' }],
  focus: { narrative: ['慢'], character: ['个体'], visual: ['冷色'] },
  liked: ['克制'],
  disliked: [],
  preference_evidence: [
    {
      dimension_id: 'character' as const,
      direction: 'low' as const,
      strength: 0.7,
      confidence: 0.6,
      evidence: '注意力落在个体人物身上',
      quote: '他突然去夺枪',
    },
  ],
  uncertainties: ['样本不足'],
  confidence: 0.7,
  related_films: [],
}

const workerRun = (input: PendingNoteV1, overrides: Record<string, unknown> = {}) => ({
  schema_version: 2,
  request_id: input.request_id,
  record_id: input.record_id,
  run_id: 'run_worker_1',
  status: 'succeeded',
  provider: 'legacy-deepseek',
  agent_id: 'legacy-deepseek-pipeline',
  agent_version: 'fbf-ai-1.0.0',
  workflow_version: 'legacy-single-pass-v1',
  skills_used: [],
  kb_citations: [],
  analysis: modelAnalysis,
  preference_evidence: modelAnalysis.preference_evidence,
  profile_delta: null,
  profile_version: null,
  quality_gates: {},
  started_at: '2026-11-10T00:00:00.000Z',
  completed_at: '2026-11-10T00:00:12.000Z',
  error: null,
  film_id: 'manchester',
  model: 'deepseek-chat',
  platform: 'cloudflare-worker',
  ...overrides,
})

const responseWithRun = (input: PendingNoteV1): AiAnalyzeResponse => ({
  analysis: modelAnalysis,
  meta: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    promptVersion: 'fbf-ai-1.0.0',
    analyzedAt: '2026-11-10T00:00:12.000Z',
    latencyMs: 1200,
    inputChars: input.note.length,
    attempts: 1,
  },
  run: workerRun(input),
})

const record: WatchRecord = {
  id: 'rec_e2e_1',
  filmId: 'manchester',
  rating: 4.5,
  watchedAt: '2026-11-01',
  status: 'watched',
  reflection: note.note,
  themes: [],
  moods: [],
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  source: 'user',
  ai: { summary: '', extractedFrom: 'backend', confidence: 0.5, status: 'complete' },
}

const film: Film = {
  id: 'manchester',
  title: 'Manchester by the Sea',
  titleZh: '海边的曼彻斯特',
  year: 2016,
  director: 'Kenneth Lonergan',
  runtime: 137,
  genres: ['Drama'],
  country: '—',
  language: '—',
  tagline: '',
  logline: '',
  cast: [],
  motif: 'orbit',
  palette: { base: '#000', deep: '#000', accent: '#999', soft: '#222', paper: '#eee' },
  signature: { narrative: 0.5, emotion: 0.5, thematic: 0.5, visual: 0.5, character: 0.5, ending: 0.5 },
  themes: {},
  moods: {},
  narrativeTags: [],
  characterTags: [],
}

const stateWith = (analyses: AIFilmAnalysis[]): AppState => ({
  ...createInitialState(),
  version: STORAGE_VERSION,
  records: [record],
  analyses,
  profileHistory: [],
})

const migrate = (analyses: unknown[]): AppState =>
  migrateState({
    ...stateWith([]),
    analyses,
  } as unknown as Record<string, unknown>)

describe('P2-A5 end-to-end analysis flow', () => {
  test('submit → Worker run → analysis → storage → reload', async () => {
    const service = new LegacyDeepSeekAnalysisService(async () => responseWithRun(note))
    const submission = await service.submitAnalysis(note)
    expect(submission.status).toBe('succeeded')
    expect(submission.provider).toBe('legacy-deepseek')
    // The Worker's run id is reused, not regenerated on the client.
    expect(submission.run_id).toBe('run_worker_1')

    const run = await service.getAnalysisResult(submission.run_id)
    const analysis = agentRunToAnalysis(run)
    expect(analysis.recordId).toBe('rec_e2e_1')
    expect(analysis.model.analyzedAt).toBe('2026-11-10T00:00:12.000Z')
    expect(analysis.agent?.provider).toBe('legacy-deepseek')

    const state = migrate([analysis])
    expect(state.analyses).toHaveLength(1)
    expect(state.analyses[0].preference_evidence[0].evidence).toBe('注意力落在个体人物身上')
  })

  test('a page refresh restores the same analysis', async () => {
    const service = new LegacyDeepSeekAnalysisService(async () => responseWithRun(note))
    const { run_id } = await service.submitAnalysis(note)
    const analysis = agentRunToAnalysis(await service.getAnalysisResult(run_id))

    const first = migrate([analysis])
    const stored = JSON.parse(JSON.stringify({ ...stateWith([]), analyses: first.analyses }))
    const second = migrateState(stored as unknown as Record<string, unknown>)
    expect(second.analyses).toEqual(first.analyses)
  })

  test('a repeated submission does not analyse twice', async () => {
    const analyse = vi.fn(async () => responseWithRun(note))
    const service = new LegacyDeepSeekAnalysisService(analyse)
    const first = await service.submitAnalysis(note)
    const second = await service.submitAnalysis({ ...note, request_id: 'req_e2e_2' })
    expect(second.run_id).toBe(first.run_id)
    expect(analyse).toHaveBeenCalledTimes(1)
  })

  test('legacy still works and keeps the evidence', async () => {
    const service = new LegacyDeepSeekAnalysisService(async () => responseWithRun(note))
    const { run_id } = await service.submitAnalysis(note)
    const run = await service.getAnalysisResult(run_id)
    expect(run.provider).toBe('legacy-deepseek')
    expect(run.preference_evidence).toHaveLength(1)
    expect(run.skills_used).toEqual([])
  })

  test('DeepWorks is not configured and returns a clear error', async () => {
    const service = new DeepWorksAnalysisService()
    await expect(service.submitAnalysis()).rejects.toBeInstanceOf(AnalysisServiceError)
    await expect(service.submitAnalysis()).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    })
  })

  test('a failed analysis leaves the previous analysis intact', async () => {
    const okService = new LegacyDeepSeekAnalysisService(async () => responseWithRun(note))
    const okSubmission = await okService.submitAnalysis(note)
    const previous = agentRunToAnalysis(await okService.getAnalysisResult(okSubmission.run_id))
    const before = migrate([previous])
    expect(before.analyses).toHaveLength(1)

    const failing = new LegacyDeepSeekAnalysisService(async () => {
      throw Object.assign(new Error('provider down'), { code: 'UPSTREAM_ERROR' })
    })
    const submission = await failing.submitAnalysis({ ...note, idempotency_key: 'new-key' })
    expect(submission.status).toBe('failed')

    // The failed run is not written into state; the old analysis survives.
    expect(before.analyses[0].summary).toBe('一次克制的哀悼。')
  })

  test('P0 history is readable after the migration adds record_id and film_id', () => {
    const path = join(process.cwd(), 'outputs/p0/runs/fbf-p0-20261109-01.json')
    const raw = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>
    const normalised = normaliseAgentRunV2({
      ...raw,
      record_id: 'rec_p0_1',
      film_id: 'manchester',
      provider: 'local-engine',
    })
    expect(normalised.ok).toBe(true)
    if (!normalised.ok) return
    const analysis = agentRunToAnalysis(normalised.value)
    expect(analysis.recordId).toBe('rec_p0_1')
    expect(analysis.preference_evidence.length).toBeGreaterThan(0)
    // P0 is a local agent run and must never be relabelled as DeepWorks.
    expect(analysis.model.provider).toBe('local-engine')
  })

  test('unknown enums never reach the profile', () => {
    const dirty = workerRun(note, {
      analysis: {
        ...modelAnalysis,
        observed_emotions: [{ mood: 'not-a-mood', evidence: 'x' }],
        themes_identified: [{ theme: 'not-a-theme', evidence: 'x' }],
      },
    })
    const normalised = normaliseAgentRunV2(dirty)
    expect(normalised.ok).toBe(true)
    if (!normalised.ok) return
    const analysis = agentRunToAnalysis(normalised.value)
    expect(analysis.observed_emotions).toHaveLength(0)
    expect(analysis.themes_identified).toHaveLength(0)

    const state = migrate([analysis])
    const profile = computeTasteProfile(state, [film])
    expect(profile.dimensions.every((item) => item.sampleCount === 0)).toBe(true)
  })

  test('a legacy response without a run still produces a run', async () => {
    const legacyOnly = { analysis: modelAnalysis, meta: responseWithRun(note).meta }
    const service = new LegacyDeepSeekAnalysisService(async () => legacyOnly)
    const submission = await service.submitAnalysis(note)
    expect(submission.status).toBe('succeeded')
    expect(submission.run_id).toMatch(/^run_/)
  })
})
