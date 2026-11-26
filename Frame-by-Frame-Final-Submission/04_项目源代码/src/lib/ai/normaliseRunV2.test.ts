import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  agentRunToAnalysis,
  isAgentRunV2,
  normaliseAgentRunV2,
  runV2ToAnalysis,
} from './normaliseRunV2'
import type { AgentRunV2 } from './contractV2'

const projectRoot = process.cwd()
const readRun = (relative: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(projectRoot, relative), 'utf8')) as Record<string, unknown>

const p0Files = [
  'outputs/p0/runs/fbf-p0-20261109-01.json',
  'outputs/p0/runs/fbf-p0-20261109-02.json',
  'outputs/p0/runs/fbf-p0-20261109-03.json',
]

const baseRun = (overrides: Partial<AgentRunV2> = {}): AgentRunV2 => ({
  schema_version: 2,
  request_id: 'req_1',
  record_id: 'rec_1',
  run_id: 'run_1',
  status: 'succeeded',
  provider: 'legacy-deepseek',
  agent_id: 'film-curator',
  agent_version: '2.0.0',
  workflow_version: '7-step-1.0.0',
  skills_used: [],
  kb_citations: [],
  analysis: {
    summary: '一段完整的解读。',
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
      dimension_id: 'emotion',
      direction: 'low',
      strength: 0.7,
      confidence: 0.6,
      evidence: '他没有哭',
      quote: '他没有哭',
    },
  ],
  profile_delta: null,
  profile_version: null,
  quality_gates: { evidence_verbatim: true },
  started_at: '2026-11-10T00:00:00.000Z',
  completed_at: '2026-11-10T00:00:10.000Z',
  error: null,
  film_id: 'film-1',
  ...overrides,
})

describe('agent-run.v2 normalisation', () => {
  test('P0 artefacts are recognised and keep every evidence row', () => {
    for (const file of p0Files) {
      const raw = readRun(file)
      expect(isAgentRunV2(raw)).toBe(true)
      const result = normaliseAgentRunV2({ ...raw, record_id: `rec_${file.length}` })
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.value.preference_evidence.length).toBe(
        (raw.preference_evidence as unknown[]).length,
      )
      expect(result.value.analysis.summary).toBe((raw.analysis as { summary: string }).summary)
      // P0 has no provider field: it must not be guessed as DeepWorks.
      expect(result.value.provider).not.toBe('deepworks')
    }
  })

  test('P1.1.1 run keeps its profile_delta and skill records', () => {
    const raw = readRun('outputs/p1/_work/v2-run.json')
    const result = normaliseAgentRunV2({ ...raw, record_id: 'rec_p1' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.profile_delta).not.toBeNull()
    expect(result.value.skills_used.length).toBe((raw.skills_used as unknown[]).length)
    expect(result.value.preference_evidence.length).toBeGreaterThan(0)
  })

  test('a v2 run converts to the website analysis shape', () => {
    const run = normaliseAgentRunV2(baseRun())
    expect(run.ok).toBe(true)
    if (!run.ok) return
    const analysis = agentRunToAnalysis(run.value)
    expect(analysis.recordId).toBe('rec_1')
    expect(analysis.filmId).toBe('film-1')
    expect(analysis.narrative_observations).toEqual(['慢'])
    expect(analysis.model.analyzedAt).toBe('2026-11-10T00:00:10.000Z')
    expect(analysis.agent?.run_id).toBe('run_1')
  })

  test('missing record_id is reported, not invented', () => {
    const result = normaliseAgentRunV2({ ...baseRun(), record_id: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('record_id is missing')
  })

  test('missing film id still converts, with an empty filmId', () => {
    const raw = baseRun({ film_id: null })
    const result = normaliseAgentRunV2(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.film_id).toBeNull()
  })

  test('ambiguity keeps the raw direction and maps the radar to neutral', () => {
    const raw = baseRun({
      preference_evidence: [
        {
          dimension_id: 'ending',
          direction: 'ambivalent',
          strength: 0.5,
          confidence: 0.4,
          evidence: '说不清',
        },
      ],
    })
    const analysis = runV2ToAnalysis(raw)
    expect(analysis?.preference_evidence[0].direction).toBe('neutral')
    expect(analysis?.preference_evidence[0].raw_direction).toBe('ambivalent')
  })

  test('an unknown direction is kept with its raw value', () => {
    const raw = baseRun({
      preference_evidence: [
        {
          dimension_id: 'visual',
          direction: 'sideways' as never,
          strength: 0.5,
          confidence: 0.4,
          evidence: '镜头很静',
        },
      ],
    })
    const result = normaliseAgentRunV2(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.preference_evidence[0].direction).toBe('neutral')
    expect(result.value.preference_evidence[0].raw_direction).toBe('sideways')
    expect(result.value.preference_evidence[0].evidence).toBe('镜头很静')
  })

  test('missing evidence falls back to interpretation, never to empty', () => {
    const raw = baseRun({
      preference_evidence: [
        {
          dimension_id: 'character',
          direction: 'low',
          strength: 0.7,
          confidence: 0.6,
          interpretation: '注意力落在个体人物身上',
        },
      ],
    })
    const result = normaliseAgentRunV2(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.preference_evidence[0].evidence).toBe('注意力落在个体人物身上')
  })

  test('a recorded analyzedAt is never replaced by the current time', () => {
    const analysis = runV2ToAnalysis(baseRun())
    expect(analysis?.model.analyzedAt).toBe('2026-11-10T00:00:10.000Z')
  })

  test('v2 synthesis survives JSON round-trip (page refresh)', () => {
    const first = runV2ToAnalysis(baseRun())
    const second = runV2ToAnalysis(JSON.parse(JSON.stringify(baseRun())))
    expect(second).toEqual(first)
  })

  test('unknown moods and themes never reach the profile', () => {
    const raw = baseRun({
      analysis: {
        ...baseRun().analysis,
        observed_emotions: [
          { mood: 'not-a-mood' as never, evidence: 'x' },
          { mood: 'restrained', evidence: '他没有哭' },
        ],
        themes_identified: [{ theme: 'not-a-theme' as never, evidence: 'x' }],
      },
    })
    const result = normaliseAgentRunV2(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.analysis.observed_emotions).toHaveLength(1)
    expect(result.value.analysis.observed_emotions[0].mood).toBe('restrained')
    expect(result.value.analysis.themes_identified).toHaveLength(0)
    expect(result.value.quality_gates.unknown_moods_filtered).toBe(false)
    expect(result.value.quality_gates.unknown_themes_filtered).toBe(false)
  })

  test('related films outside the catalogue are filtered', () => {
    const raw = baseRun({
      analysis: {
        ...baseRun().analysis,
        related_films: [
          { film_id: 'not-in-catalogue', relationship: 'same mood', explanation: 'x' },
        ],
      },
    })
    const result = normaliseAgentRunV2(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.analysis.related_films).toHaveLength(0)
    expect(result.value.quality_gates.unknown_films_filtered).toBe(false)
  })
})
