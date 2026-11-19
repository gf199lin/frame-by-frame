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

  test('turns a legacy single feeling into a multi-select tag', () => {
    const legacy = {
      ...v1State,
      records: [{ ...v1Record, feltLike: 'tender' }],
    }
    const state = migrateState(legacy as unknown as Record<string, unknown>)
    expect(state.records[0].feltLike).toBe('tender')
    expect(state.records[0].feltLikeTags).toEqual(['tender'])
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

const agentRun = {
  schema_version: 2,
  request_id: 'req_1',
  record_id: 'rec_1',
  run_id: 'run_1',
  status: 'succeeded',
  provider: 'legacy-deepseek',
  agent_id: 'film-curator',
  agent_version: '2.0.0',
  workflow_version: '7-step-1.0.0',
  skills_used: [{ name: 'film-note-analysis', invoked: true, via: 'skill', version: 'sha256:x' }],
  kb_citations: [{ kb_id: 'KB-004', title: '克制', excerpt: '原文片段' }],
  analysis: {
    summary: '一次克制的哀悼。',
    observed_emotions: [{ mood: 'restrained', evidence: '他没有哭' }],
    themes_identified: [{ theme: 'grief', evidence: '哀悼' }],
    focus: { narrative: ['慢'], character: ['个体'], visual: ['冷色'] },
    liked: ['克制'],
    disliked: [],
    uncertainties: ['样本不足'],
    confidence: 0.7,
    related_films: [],
  },
  preference_evidence: [
    {
      dimension_id: 'ending',
      direction: 'ambivalent',
      strength: 0.5,
      confidence: 0.4,
      interpretation: '结局既像解脱又像拒绝闭合',
      quote: '说不清',
    },
  ],
  profile_delta: { schema_version: 2, dimensions: {} },
  profile_version: 'v2',
  quality_gates: { evidence_verbatim: true },
  started_at: '2026-11-10T00:00:00.000Z',
  completed_at: '2026-11-10T00:00:10.000Z',
  error: null,
  film_id: 'film-1',
}

describe('storage v2 compatibility', () => {
  const stateWithRun = {
    ...v1State,
    analyses: [agentRun],
  }

  test('does not discard an agent-run.v2 result', () => {
    const state = migrateState(stateWithRun as unknown as Record<string, unknown>)
    expect(state.analyses).toHaveLength(1)
    expect(state.analyses[0].recordId).toBe('rec_1')
    expect(state.analyses[0].filmId).toBe('film-1')
  })

  test('keeps focus observations that v1 stored as flat arrays', () => {
    const state = migrateState(stateWithRun as unknown as Record<string, unknown>)
    expect(state.analyses[0].narrative_observations).toEqual(['慢'])
    expect(state.analyses[0].character_observations).toEqual(['个体'])
    expect(state.analyses[0].visual_observations).toEqual(['冷色'])
  })

  test('maps ambivalent to neutral but keeps the original claim', () => {
    const state = migrateState(stateWithRun as unknown as Record<string, unknown>)
    const evidence = state.analyses[0].preference_evidence[0]
    expect(evidence.direction).toBe('neutral')
    expect(evidence.raw_direction).toBe('ambivalent')
    expect(evidence.evidence).toBe('结局既像解脱又像拒绝闭合')
  })

  test('keeps the recorded analyzedAt instead of overwriting it', () => {
    const state = migrateState(stateWithRun as unknown as Record<string, unknown>)
    expect(state.analyses[0].model.analyzedAt).toBe('2026-11-10T00:00:10.000Z')
  })

  test('preserves provider provenance and citations', () => {
    const state = migrateState(stateWithRun as unknown as Record<string, unknown>)
    expect(state.analyses[0].agent?.provider).toBe('legacy-deepseek')
    expect(state.analyses[0].agent?.kb_citations?.[0].kb_id).toBe('KB-004')
    expect(state.analyses[0].agent?.skills_used?.[0].via).toBe('skill')
  })

  test('survives a page refresh (JSON round-trip)', () => {
    const once = migrateState(stateWithRun as unknown as Record<string, unknown>)
    const stored = JSON.parse(JSON.stringify({ ...v1State, analyses: once.analyses }))
    const twice = migrateState(stored as unknown as Record<string, unknown>)
    expect(twice.analyses).toEqual(once.analyses)
  })

  test('a run with no record_id cannot be attached, but the note survives', () => {
    const orphan = {
      ...v1State,
      analyses: [{ ...agentRun, record_id: '' }],
    }
    const state = migrateState(orphan as unknown as Record<string, unknown>)
    expect(state.analyses).toHaveLength(0)
    expect(state.records[0].reflection).toBe('这是一段不能丢失的私人笔记。')
  })

  test('v2 archives gain empty evolution fields without losing anything', () => {
    const state = migrateState(v1State as unknown as Record<string, unknown>)
    expect(state.observationFeedback).toEqual([])
    expect(state.tasteSnapshots).toEqual([])
    expect(state.records[0].reflection).toBe('这是一段不能丢失的私人笔记。')
  })

  test('v3 feedback and snapshots survive a reload', () => {
    const stored = {
      ...v1State,
      observationFeedback: [
        {
          feedback_id: 'fb_obs_visual_1',
          observation_id: 'obs_visual',
          decision: 'partially_accepted',
          user_comment: '我注意的是表演。',
          created_at: '2026-11-16T10:00:00.000Z',
          affected_snapshot_id: 'snap_1',
        },
      ],
      tasteSnapshots: [
        {
          snapshot_id: 'snap_1',
          created_at: '2026-11-16T09:00:00.000Z',
          run_id: 'run-1',
          record_count: 1,
          observations: [],
          dimensions: [],
          overall_confidence: 0.2,
          changes: [],
          corrections_applied: [],
          signature: 'abc1234',
        },
      ],
    }
    const state = migrateState(stored as unknown as Record<string, unknown>)
    expect(state.observationFeedback).toHaveLength(1)
    expect(state.observationFeedback[0].user_comment).toBe('我注意的是表演。')
    expect(state.tasteSnapshots).toHaveLength(1)
    expect(state.tasteSnapshots[0].snapshot_id).toBe('snap_1')
  })
})
