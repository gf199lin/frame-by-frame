import { describe, expect, test } from 'vitest'
import { analysisSourceLabel, isModelProvider } from './sourceLabel'
import { FALLBACK_NOTICE } from './localFallback'
import { buildLocalFilmAnalysis } from './localAnalysis'
import { FILMS } from '@/data/films'
import type { AddFilmDraft } from '@/types'

describe('analysis source labels', () => {
  test('keeps the local rule engine distinct from model providers', () => {
    expect(analysisSourceLabel('legacy-deepseek')).toContain('DeepSeek')
    expect(analysisSourceLabel('deepworks')).toContain('DeepWorks')
    expect(analysisSourceLabel('local-engine')).toContain('本地规则引擎')
    expect(analysisSourceLabel('local-engine')).not.toContain('AI')
    expect(isModelProvider('local-engine')).toBe(false)
    expect(isModelProvider('legacy-deepseek')).toBe(true)
    expect(isModelProvider('deepworks')).toBe(true)
  })

  test('fallback notices state that no model ran', () => {
    expect(FALLBACK_NOTICE.not_configured).toContain('没有调用任何模型')
    expect(FALLBACK_NOTICE.request_failed).toContain('没有调用任何模型')
  })
})

describe('local fallback analysis', () => {
  test('is labelled local-engine and never claims a model', () => {
    const film = FILMS[0]
    const draft: AddFilmDraft = {
      filmId: film.id,
      rating: 4,
      watchedAt: '2026-11-19',
      status: 'watched',
      reflection: '镜头很克制，最后那一段一直留在心里。',
      feltLikeTags: ['restrained'],
    }

    const analysis = buildLocalFilmAnalysis(film, draft, [], FILMS, 'rec_test')

    expect(analysis.model.provider).toBe('local-engine')
    expect(analysis.model.model).toBe('analyst-v1')
    expect(analysis.uncertainties.join('')).toContain('没有调用外部模型')
  })
})
