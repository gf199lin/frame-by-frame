import { describe, expect, test } from 'vitest'
import { FILMS } from '@/data/films'
import { createRecordFromAnalysis, createRecordWithoutAnalysis } from './adapter'
import type { AddFilmDraft, AIFilmAnalysis } from '@/types'

const film = FILMS.find((item) => item.id === 'eternal-sunshine')!
const draft: AddFilmDraft = {
  filmId: film.id,
  rating: 4.5,
  watchedAt: '2026-11-02',
  status: 'watched',
  reflection: '这是一段足够长的私人笔记，用来验证保存时不会丢失多选感受。',
  feltLikeTags: ['tender', '像一场潮湿的雨', 'wistful'],
}

describe('record creation with felt-like tags', () => {
  test('keeps every chosen feeling and the readable legacy field', () => {
    const record = createRecordWithoutAnalysis(film, draft, 'rec_test', 'skipped')
    expect(record.feltLikeTags).toEqual(['tender', '像一场潮湿的雨', 'wistful'])
    expect(record.feltLike).toBe('温柔、像一场潮湿的雨、怅惘')
  })

  test('only promotes known mood ids into the graph moods', () => {
    const record = createRecordWithoutAnalysis(film, draft, 'rec_test', 'skipped')
    expect(record.moods).toEqual(['tender', 'wistful'])
  })

  test('keeps felt-like tags after a successful analysis', () => {
    const analysis: AIFilmAnalysis = {
      schemaVersion: 1,
      recordId: 'rec_test',
      filmId: film.id,
      status: 'complete',
      summary: '一次分析',
      observed_emotions: [{ mood: 'tender', evidence: '温柔' }],
      themes_identified: [],
      narrative_observations: [],
      character_observations: [],
      visual_observations: [],
      liked: [],
      disliked: [],
      preference_evidence: [],
      uncertainties: [],
      confidence: 0.8,
      related_films: [],
      model: {
        provider: 'fake',
        model: 'fake-1',
        promptVersion: 'v1',
        analyzedAt: '2026-11-09T00:00:00.000Z',
      },
      review: { verdict: 'unreviewed', updatedAt: '2026-11-09T00:00:00.000Z' },
    }
    const record = createRecordFromAnalysis(film, draft, analysis, 'rec_test')
    expect(record.feltLikeTags).toEqual(['tender', '像一场潮湿的雨', 'wistful'])
    expect(record.feltLike).toBe('温柔、像一场潮湿的雨、怅惘')
  })
})
