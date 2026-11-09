import { describe, expect, test } from 'vitest'
import { validateAnalyzeResponse, validateModelAnalysis } from './validate'
import { HISTORY_IDS, NOTE, validAnalysis, validResponse } from '../../../server/core/__fixtures__/analyses'

const context = { note: NOTE, historyIds: HISTORY_IDS }

describe('client response validator', () => {
  test('accepts the same payload the server accepts', () => {
    const result = validateAnalyzeResponse(validResponse(), context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.analysis.preference_evidence).toHaveLength(3)
    expect(result.value.meta.model).toBe('deepseek-chat')
  })

  test('rejects a response without provenance metadata', () => {
    const raw = validResponse() as Record<string, unknown>
    delete raw.meta
    const result = validateAnalyzeResponse(raw, context)
    expect(result.ok).toBe(false)
  })

  test('rejects unknown dimension ids from a corrupted response', () => {
    const raw = validAnalysis()
    raw.preference_evidence[0].dimension_id = 'genre'
    const result = validateModelAnalysis(raw, context)
    expect(result.ok).toBe(false)
  })

  test('rejects an unknown theme id', () => {
    const raw = validAnalysis()
    raw.themes_identified[0].theme = 'space-opera'
    const result = validateModelAnalysis(raw, context)
    expect(result.ok).toBe(false)
  })

  test('drops a fabricated quote but keeps the grounded claim', () => {
    const raw = validAnalysis()
    raw.preference_evidence[0].quote = '用户从未写过的句子'
    const result = validateModelAnalysis(raw, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.preference_evidence[0].quote).toBeUndefined()
    expect(result.value.preference_evidence[0].evidence).toBeTruthy()
  })

  test('drops a related film that is not in the supplied history', () => {
    const raw = validAnalysis()
    raw.related_films.push({ film_id: 'ghost', relationship: 'same-theme', explanation: '不存在' })
    const result = validateModelAnalysis(raw, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.related_films.map((item) => item.film_id)).toEqual(['film-b'])
  })

  test('rejects out-of-range confidence values', () => {
    const raw = validAnalysis()
    raw.confidence = 1.7
    const result = validateModelAnalysis(raw, context)
    expect(result.ok).toBe(false)
  })
})
