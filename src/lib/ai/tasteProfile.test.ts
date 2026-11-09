import { describe, expect, test } from 'vitest'
import { computeTasteProfile, dimensionProfileDelta } from './tasteProfile'
import type { AIFilmAnalysis, AppState, DimensionKey, Film, WatchRecord } from '@/types'
import { createInitialState } from '@/data/seed'
import { STORAGE_VERSION } from '@/data/taxonomy'

const film = (id: string): Film => ({
  id,
  title: `Film ${id}`,
  titleZh: '',
  year: 2020,
  director: 'Director',
  runtime: 110,
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
})

const record = (id: string, filmId: string, rating = 4, noteLength = 120): WatchRecord => ({
  id,
  filmId,
  rating,
  watchedAt: '2026-10-01',
  status: 'watched',
  reflection: '这是一段足够长的观影笔记，用来描述我在电影里看到和感受到的东西。'.repeat(
    Math.max(1, Math.ceil(noteLength / 30)),
  ),
  themes: [],
  moods: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  source: 'user',
  ai: { summary: '', extractedFrom: 'backend', confidence: 0.5, status: 'complete' },
})

const contribution = (
  dimension: DimensionKey,
  direction: 'low' | 'high' | 'neutral',
  strength: number,
  confidence = 0.6,
) => ({
  dimension_id: dimension,
  direction,
  strength,
  confidence,
  evidence: `${dimension} evidence`,
  quote: '这是一段足够长的观影笔记',
})

const analysis = (
  recordId: string,
  filmId: string,
  contributions: ReturnType<typeof contribution>[],
  options: { verdict?: AIFilmAnalysis['review']['verdict']; confidence?: number } = {},
): AIFilmAnalysis => ({
  schemaVersion: 1,
  recordId,
  filmId,
  status: 'complete',
  summary: 'summary',
  observed_emotions: [{ mood: 'restrained', evidence: 'evidence' }],
  themes_identified: [{ theme: 'memory', evidence: 'evidence' }],
  narrative_observations: [],
  character_observations: [],
  visual_observations: [],
  liked: [],
  disliked: [],
  preference_evidence: contributions,
  uncertainties: [],
  confidence: options.confidence ?? 0.6,
  related_films: [],
  model: {
    provider: 'test',
    model: 'test-model',
    promptVersion: 'test',
    analyzedAt: '2026-11-01T10:00:00.000Z',
  },
  review: { verdict: options.verdict ?? 'accepted', updatedAt: '2026-11-01T10:00:00.000Z' },
})

const stateWith = (analyses: AIFilmAnalysis[], count = 3, feedback: AppState['feedback'] = {}): AppState => {
  const base = createInitialState()
  const ids = Array.from({ length: count }, (_, index) => `r${index + 1}`)
  return {
    ...base,
    version: STORAGE_VERSION,
    records: ids.map((id) => record(id, `f-${id}`)),
    analyses,
    feedback,
    profileHistory: [],
  }
}

const filmsFor = (count = 3): Film[] =>
  Array.from({ length: count }, (_, index) => film(`f-r${index + 1}`))

describe('computeTasteProfile', () => {
  test('never invents a shape when there is no confirmed analysis', () => {
    const profile = computeTasteProfile(stateWith([]), filmsFor())
    expect(profile.acceptedCount).toBe(0)
    expect(profile.sampleState).toBe('empty')
    expect(profile.overallConfidence).toBe(0)
    expect(profile.signature).toContain('还没有')
    for (const dimension of profile.dimensions) {
      expect(dimension.confidence).toBe(0)
      expect(dimension.sufficient).toBe(false)
      expect(dimension.value).toBe(0.5)
      expect(dimension.aiEvidence).toHaveLength(0)
    }
  })

  test('excludes analyses the user rejected', () => {
    const profile = computeTasteProfile(
      stateWith([analysis('r1', 'f-r1', [contribution('emotion', 'low', 0.8)], { verdict: 'rejected' })]),
      filmsFor(),
    )
    expect(profile.acceptedCount).toBe(0)
    expect(profile.dimensions.find((item) => item.key === 'emotion')?.sampleCount).toBe(0)
  })

  test('excludes a contribution the user removed', () => {
    const removed = { ...contribution('emotion', 'low', 0.8), userStatus: 'removed' as const }
    const profile = computeTasteProfile(
      stateWith([analysis('r1', 'f-r1', [removed])]),
      filmsFor(),
    )
    expect(profile.dimensions.find((item) => item.key === 'emotion')?.sampleCount).toBe(0)
  })

  test('needs at least three consistent films before claiming a direction', () => {
    const consistent = ['r1', 'r2', 'r3'].map((id, _index) =>
      analysis(id, `f-${id}`, [contribution('emotion', 'low', 0.75)], { confidence: 0.7 }),
    )
    const profile = computeTasteProfile(stateWith(consistent), filmsFor())
    const emotion = profile.dimensions.find((item) => item.key === 'emotion')!
    expect(emotion.sufficient).toBe(true)
    expect(emotion.sampleCount).toBe(3)
    expect(emotion.lean).toBeLessThan(0)
    expect(emotion.value).toBeLessThan(0.5)
    expect(emotion.confidence).toBeGreaterThan(0.32)
    expect(profile.sampleState).not.toBe('empty')
  })

  test('a single film can never be sufficient', () => {
    const profile = computeTasteProfile(
      stateWith([analysis('r1', 'f-r1', [contribution('emotion', 'low', 1)], { confidence: 0.9 })], 1),
      filmsFor(1),
    )
    const emotion = profile.dimensions.find((item) => item.key === 'emotion')!
    expect(emotion.sufficient).toBe(false)
    expect(emotion.thin).toBe(true)
  })

  test('conflicting evidence lowers confidence and withholds the claim', () => {
    const conflicting = [
      analysis('r1', 'f-r1', [contribution('emotion', 'low', 0.9)]),
      analysis('r2', 'f-r2', [contribution('emotion', 'high', 0.9)]),
      analysis('r3', 'f-r3', [contribution('emotion', 'neutral', 0.2)]),
    ]
    const consistent = [
      analysis('r1', 'f-r1', [contribution('emotion', 'low', 0.9)]),
      analysis('r2', 'f-r2', [contribution('emotion', 'low', 0.9)]),
      analysis('r3', 'f-r3', [contribution('emotion', 'low', 0.9)]),
    ]
    const conflictingProfile = computeTasteProfile(stateWith(conflicting), filmsFor())
    const consistentProfile = computeTasteProfile(stateWith(consistent), filmsFor())
    const conflict = conflictingProfile.dimensions.find((item) => item.key === 'emotion')!
    const stable = consistentProfile.dimensions.find((item) => item.key === 'emotion')!
    expect(conflict.confidence).toBeLessThan(stable.confidence)
    expect(conflict.sufficient).toBe(false)
  })

  test('user corrections reduce confidence for that dimension', () => {
    const consistent = ['r1', 'r2', 'r3'].map((id) =>
      analysis(id, `f-${id}`, [contribution('emotion', 'low', 0.8)], { confidence: 0.7 }),
    )
    const plain = computeTasteProfile(stateWith(consistent), filmsFor())
    const corrected = computeTasteProfile(
      stateWith(consistent, 3, {
        emotion: { verdict: 'corrected', correction: '不是这样', updatedAt: '2026-11-02T00:00:00.000Z' },
      }),
      filmsFor(),
    )
    expect(
      corrected.dimensions.find((item) => item.key === 'emotion')!.confidence,
    ).toBeLessThan(plain.dimensions.find((item) => item.key === 'emotion')!.confidence)
  })

  test('pending analyses are counted but never used as evidence', () => {
    const pending = analysis('r1', 'f-r1', [contribution('emotion', 'low', 0.9)], {
      verdict: 'unreviewed',
    })
    const profile = computeTasteProfile(stateWith([pending], 1), filmsFor(1))
    expect(profile.pendingCount).toBe(1)
    expect(profile.acceptedCount).toBe(0)
    expect(profile.dimensions.find((item) => item.key === 'emotion')!.sampleCount).toBe(0)
  })

  test('profile deltas only report real movement', () => {
    const before = computeTasteProfile(stateWith([]), filmsFor())
    const after = computeTasteProfile(
      stateWith(
        ['r1', 'r2', 'r3'].map((id) => analysis(id, `f-${id}`, [contribution('emotion', 'low', 0.8)])),
      ),
      filmsFor(),
    )
    const deltas = dimensionProfileDelta(before, after)
    expect(deltas.some((change) => change.dimension === 'emotion')).toBe(true)
    expect(deltas.find((change) => change.dimension === 'emotion')!.afterConfidence).toBeGreaterThan(0)
  })
})
