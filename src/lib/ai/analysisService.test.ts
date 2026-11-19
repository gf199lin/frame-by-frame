import { describe, expect, test, vi } from 'vitest'
import {
  AnalysisServiceError,
  DeepWorksAnalysisService,
  LegacyDeepSeekAnalysisService,
  createAnalysisService,
} from './analysisService'
import type { AnalyseFn } from './analysisService'
import type { PendingNoteV1 } from './contractV2'
import type { AiAnalyzeResponse } from './types'

const note: PendingNoteV1 = {
  schema_version: 1,
  request_id: 'req_1',
  record_id: 'rec_1',
  idempotency_key: 'idem_1',
  user_id: 'user_1',
  consent: { allow_ai_notes: true, policy_version: '2026-11-01' },
  created_at: '2026-11-10T00:00:00.000Z',
  film: { id: 'film-1', title: 'Manchester by the Sea', year: 2016 },
  rating: 4.5,
  note: '这是一段足够长的观影笔记，用来验证适配层不会丢失任何证据。',
  note_sha256: 'a'.repeat(64),
  felt_like: ['restrained'],
}

const response: AiAnalyzeResponse = {
  analysis: {
    summary: '一次克制的哀悼。',
    observed_emotions: [{ mood: 'restrained', evidence: '他没有哭' }],
    themes_identified: [{ theme: 'grief', evidence: '哀悼' }],
    focus: { narrative: ['慢'], character: ['个体'], visual: ['冷色'] },
    liked: ['克制'],
    disliked: [],
    preference_evidence: [
      {
        dimension_id: 'emotion',
        direction: 'low',
        strength: 0.7,
        confidence: 0.6,
        evidence: '他没有哭',
        quote: '他没有哭',
      },
    ],
    uncertainties: ['样本不足'],
    confidence: 0.7,
    related_films: [],
  },
  meta: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    promptVersion: 'fbf-ai-1.0.0',
    analyzedAt: '2026-11-10T00:00:10.000Z',
    latencyMs: 900,
    inputChars: 30,
    attempts: 1,
  },
}

const okAnalyse: AnalyseFn = async () => response

describe('legacy DeepSeek analysis service', () => {
  test('reports legacy-deepseek, never deepworks', async () => {
    const service = new LegacyDeepSeekAnalysisService(okAnalyse)
    const submission = await service.submitAnalysis(note)
    expect(submission.provider).toBe('legacy-deepseek')
    expect(submission.status).toBe('succeeded')

    const run = await service.getAnalysisResult(submission.run_id)
    expect(run.provider).toBe('legacy-deepseek')
    expect(run.platform).toBe('cloudflare-worker')
    expect(run.skills_used).toEqual([])
    expect(run.quality_gates).toEqual({})
    expect(run.analysis.focus?.narrative).toEqual(['慢'])
  })

  test('keeps the evidence the model produced', async () => {
    const service = new LegacyDeepSeekAnalysisService(okAnalyse)
    const { run_id } = await service.submitAnalysis(note)
    const run = await service.getAnalysisResult(run_id)
    expect(run.preference_evidence).toHaveLength(1)
    expect(run.preference_evidence[0].evidence).toBe('他没有哭')
  })

  test('a repeated request_id returns the original run', async () => {
    const analyse = vi.fn(okAnalyse)
    const service = new LegacyDeepSeekAnalysisService(analyse)
    const first = await service.submitAnalysis(note)
    const second = await service.submitAnalysis({ ...note, idempotency_key: 'idem_2' })
    expect(second.run_id).toBe(first.run_id)
    expect(analyse).toHaveBeenCalledTimes(1)
  })

  test('a repeated idempotency key returns the original run', async () => {
    const analyse = vi.fn(okAnalyse)
    const service = new LegacyDeepSeekAnalysisService(analyse)
    const first = await service.submitAnalysis(note)
    const second = await service.submitAnalysis({ ...note, request_id: 'req_2' })
    expect(second.run_id).toBe(first.run_id)
    expect(analyse).toHaveBeenCalledTimes(1)
  })

  test('a failed analysis is stored as failed and never as success', async () => {
    const failure = Object.assign(new Error('provider down'), {
      code: 'UPSTREAM_ERROR',
      retryable: true,
    })
    const service = new LegacyDeepSeekAnalysisService(async () => {
      throw failure
    })
    const submission = await service.submitAnalysis(note)
    expect(submission.status).toBe('failed')

    const status = await service.getAnalysisStatus(submission.run_id)
    expect(status.status).toBe('failed')
    expect(status.error?.code).toBe('UPSTREAM_ERROR')

    await expect(service.getAnalysisResult(submission.run_id)).rejects.toMatchObject({
      code: 'ANALYSIS_FAILED',
    })
  })

  test('refuses to analyse without explicit consent', async () => {
    const service = new LegacyDeepSeekAnalysisService(okAnalyse)
    await expect(
      service.submitAnalysis({ ...note, consent: { allow_ai_notes: false } }),
    ).rejects.toBeInstanceOf(AnalysisServiceError)
  })

  test('an unknown run id is not found', async () => {
    const service = new LegacyDeepSeekAnalysisService(okAnalyse)
    await expect(service.getAnalysisResult('run_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('DeepWorks provider placeholder', () => {
  test('is not configured and produces no result', async () => {
    const service = new DeepWorksAnalysisService()
    expect(service.provider).toBe('deepworks')
    await expect(service.submitAnalysis()).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    })
    expect((await service.getAnalysisStatus('run_1')).status).toBe('not_configured')
    await expect(service.getAnalysisResult()).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    })
  })

  test('the factory selects it only when explicitly asked', () => {
    expect(createAnalysisService({ provider: 'deepworks' }).provider).toBe('deepworks')
    expect(createAnalysisService({ provider: 'legacy-deepseek' }).provider).toBe('legacy-deepseek')
    expect(createAnalysisService({ provider: undefined }).provider).toBe('legacy-deepseek')
  })
})
