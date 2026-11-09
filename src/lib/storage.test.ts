import { describe, expect, test } from 'vitest'
import { migrateState } from './storage'
import { STORAGE_VERSION } from '@/data/taxonomy'

const v1Record = {
  id: 'rec_1',
  filmId: 'film-1',
  rating: 4.5,
  watchedAt: '2026-01-02',
  status: 'watched',
  reflection: '这是一段不能丢失的私人笔记。',
  themes: ['memory'],
  moods: ['tender'],
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  source: 'user',
  ai: { summary: '旧版解读', extractedFrom: 'local-engine', confidence: 0.4 },
}

const v1State = {
  version: 1,
  records: [v1Record],
  feedback: { emotion: { verdict: 'agree', updatedAt: '2026-01-03T10:00:00.000Z' } },
  timelineFeedback: {},
  customFilms: [],
  corrections: [{ id: 'c1', scope: 'dimension:emotion', text: '我的原话', createdAt: '2026-01-03T10:00:00.000Z' }],
  yearbookGenerations: ['2026'],
}

describe('storage migration', () => {
  test('lifts a v1 archive without losing a single record or note', () => {
    const state = migrateState(v1State as unknown as Record<string, unknown>)
    expect(state.version).toBe(STORAGE_VERSION)
    expect(state.records).toHaveLength(1)
    expect(state.records[0].reflection).toBe('这是一段不能丢失的私人笔记。')
    expect(state.records[0].rating).toBe(4.5)
    expect(state.records[0].watchedAt).toBe('2026-01-02')
    expect(state.corrections).toHaveLength(1)
    expect(state.yearbookGenerations).toEqual(['2026'])
    expect(state.feedback.emotion?.verdict).toBe('agree')
  })

  test('adds the v2 AI scaffolding with consent off by default', () => {
    const state = migrateState(v1State as unknown as Record<string, unknown>)
    expect(state.analyses).toEqual([])
    expect(state.profileHistory).toEqual([])
    expect(state.settings.allowAiNotes).toBe(false)
  })

  test('fills missing AI metadata instead of crashing on old records', () => {
    const broken = {
      ...v1State,
      records: [{ ...v1Record, ai: undefined }],
    }
    const state = migrateState(broken as unknown as Record<string, unknown>)
    expect(state.records[0].ai.summary).toBe('')
    expect(state.records[0].ai.extractedFrom).toBe('local-engine')
  })

  test('keeps the user note even when its AI analysis is dropped', () => {
    const withAnalysis = {
      ...v1State,
      analyses: [
        {
          recordId: 'rec_missing',
          filmId: 'film-1',
          status: 'complete',
          summary: 'orphan',
          preference_evidence: [],
          review: { verdict: 'accepted', updatedAt: '2026-01-01T00:00:00.000Z' },
          model: { provider: 'x', model: 'y', promptVersion: 'z', analyzedAt: '2026-01-01T00:00:00.000Z' },
        },
      ],
    }
    const state = migrateState(withAnalysis as unknown as Record<string, unknown>)
    expect(state.analyses).toHaveLength(0)
    expect(state.records).toHaveLength(1)
  })

  test('does not wipe an archive written by a newer version', () => {
    const future = { ...v1State, version: 99 }
    const state = migrateState(future as unknown as Record<string, unknown>)
    expect(state.records).toHaveLength(1)
    expect(state.records[0].reflection).toBe('这是一段不能丢失的私人笔记。')
  })
})
