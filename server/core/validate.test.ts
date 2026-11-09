import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateModelAnalysis, validateAnalyzeRequest, normaliseForGrounding } from './validate.ts'
import { HISTORY_IDS, NOTE, validAnalysis } from './__fixtures__/analyses.ts'

const context = { note: NOTE, historyIds: HISTORY_IDS }

test('accepts a well-formed analysis and keeps every field', () => {
  const result = validateModelAnalysis(validAnalysis(), context)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.preference_evidence.length, 3)
  assert.equal(result.value.observed_emotions[0].mood, 'restrained')
  assert.equal(result.value.related_films[0].film_id, 'film-b')
  assert.equal(result.value.confidence, 0.55)
})

test('rejects an unknown dimension id', () => {
  const raw = validAnalysis()
  raw.preference_evidence[0].dimension_id = 'genre'
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('dimension_id')))
})

test('rejects an unknown mood id', () => {
  const raw = validAnalysis()
  raw.observed_emotions[0].mood = 'happy'
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, false)
})

test('rejects an out-of-range strength', () => {
  const raw = validAnalysis()
  raw.preference_evidence[0].strength = 1.4
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('strength')))
})

test('drops a quote that is not literally present in the note', () => {
  const raw = validAnalysis()
  raw.preference_evidence[0].quote = '这是一句用户没有写过的原文'
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.preference_evidence[0].quote, undefined)
  assert.ok(result.warnings.some((warning) => warning.includes('ungrounded quote')))
})

test('keeps a quote that matches after punctuation normalisation', () => {
  const raw = validAnalysis()
  raw.preference_evidence[0].quote = '我喜欢它没有把和解拍成一个拥抱'
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.value.preference_evidence[0].quote)
})

test('drops related films that were never supplied in the history', () => {
  const raw = validAnalysis()
  raw.related_films.push({
    film_id: 'film-hallucinated',
    relationship: 'same-theme',
    explanation: '不存在的电影',
  })
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.related_films.length, 1)
  assert.ok(result.warnings.some((warning) => warning.includes('film-hallucinated')))
})

test('ignores unknown extra fields instead of persisting them', () => {
  const raw = validAnalysis() as Record<string, unknown>
  raw.secret_extra = { anything: true }
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal('secret_extra' in result.value, false)
  assert.ok(result.warnings.some((warning) => warning.includes('secret_extra')))
})

test('rejects an empty preference evidence list', () => {
  const raw = validAnalysis()
  raw.preference_evidence = []
  const result = validateModelAnalysis(raw, context)
  assert.equal(result.ok, false)
})

test('request validation rejects a note without user words', () => {
  const result = validateAnalyzeRequest({
    film: { id: 'film-a', title: '测试电影', year: 2020 },
    rating: 4,
    note: '短',
  })
  assert.equal(result.ok, false)
})

test('request validation caps history and never mutates the note', () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    id: `film-${index}`,
    title: `Film ${index}`,
    year: 2000 + index,
    rating: 4,
  }))
  const result = validateAnalyzeRequest({
    film: { id: 'film-a', title: '测试电影', year: 2020 },
    rating: 4,
    note: NOTE,
    history,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.history?.length, 8)
  assert.equal(result.value.note, NOTE)
})

test('grounding normalisation removes punctuation but keeps words', () => {
  assert.equal(normaliseForGrounding('我，喜欢 它。'), normaliseForGrounding('我喜欢它'))
})
