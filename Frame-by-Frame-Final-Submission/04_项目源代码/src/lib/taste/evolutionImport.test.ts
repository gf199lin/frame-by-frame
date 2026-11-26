import { describe, expect, test } from 'vitest'
import { createInitialState } from '@/data/seed'
import { FILMS } from '@/data/films'
import { appReducer } from '@/store/AppStore'
import { computeEvolution } from '@/lib/taste/evolution'
import { importEvolutionDoc, sha256Hex } from '@/lib/taste/evolutionImport'
import type { TasteEvolutionEvidence, TasteEvolutionSnapshot, TasteObservation } from '@/types'

const QUOTE = '艺术是一种许可，也带着账单'

const makeDoc = async (overrides: Record<string, unknown> = {}) => {
  const state = createInitialState()
  const record = state.records.find((item) => item.id === 'rec_deadpoets')!
  const sha = await sha256Hex(record.reflection)
  const observation: TasteObservation = {
    observation_id: 'obs_thematic',
    dimension: 'thematic',
    title: '代价先于口号',
    description: '1 部电影、1 条证据，方向支持，仍不足以称为稳定偏好。',
    current_stage: 'emerging',
    confidence: 0.42,
    first_observed_at: '2026-11-17T06:00:00.000Z',
    last_updated_at: '2026-11-17T06:00:00.000Z',
    supporting_record_ids: ['rec_deadpoets'],
    supporting_evidence_ids: ['ev_rec_deadpoets_thematic_test'],
    contradicting_evidence_ids: [],
    accepted_feedback_count: 0,
    partially_accepted_feedback_count: 0,
    rejected_feedback_count: 0,
    unsure_feedback_count: 0,
    history: [
      {
        at: '2026-11-17T06:00:00.000Z',
        snapshot_id: 'snap_test_01',
        stage: 'emerging',
        confidence: 0.42,
        supporting_count: 1,
        contradicting_count: 0,
        reason: '新的已确认证据第一次形成了这条观察。',
      },
    ],
    evidence: [],
    dominant_direction: 'high',
    effective: true,
    record_count: 1,
    evidence_count: 1,
    unverified_evidence_count: 0,
  }
  const evidence: TasteEvolutionEvidence = {
    evidence_id: 'ev_rec_deadpoets_thematic_test',
    observation_id: 'obs_thematic',
    record_id: 'rec_deadpoets',
    film_id: 'dead-poets',
    film_title: 'Dead Poets Society',
    film_year: 1989,
    dimension: 'thematic',
    original_quote: QUOTE,
    interpretation: '你注意到艺术带来的许可同时也要付账。',
    polarity: 'supporting',
    strength: 0.7,
    source: 'deepworks',
    created_at: '2026-11-17T06:00:00.000Z',
    run_id: 'run-test-a',
  }
  const snapshot: TasteEvolutionSnapshot = {
    snapshot_id: 'snap_test_01',
    created_at: '2026-11-17T06:00:00.000Z',
    run_id: 'run-test-a',
    record_count: 1,
    observations: [],
    dimensions: [],
    overall_confidence: 0.42,
    changes: [],
    corrections_applied: [],
    signature: 'sig_test_01',
  }
  return {
    state,
    doc: {
      schema_version: 'taste-evolution.v1',
      run_id: 'run-test-a',
      record_id: 'rec_deadpoets',
      film_id: 'dead-poets',
      analyzed_at: '2026-11-17T06:00:00.000Z',
      inputs: { note_sha256: sha },
      observations: [observation],
      evidence: [evidence],
      feedback_applied: [],
      snapshot,
      ...overrides,
    } as Record<string, unknown>,
  }
}

describe('agent evolution import', () => {
  test('accepts a document whose quote and hash match the stored note', async () => {
    const { state, doc } = await makeDoc()
    const result = await importEvolutionDoc(doc, state)
    expect(result.failures).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.bundles).toHaveLength(1)
    expect(result.snapshot?.snapshot_id).toBe('snap_test_01')
  })

  test('rejects a quote that is not verbatim in the note', async () => {
    const { state, doc } = await makeDoc()
    const evidence = (doc.evidence as TasteEvolutionEvidence[])[0]
    evidence.original_quote = '艺术是一种许可，也带着代价'
    const result = await importEvolutionDoc(doc, state)
    expect(result.ok).toBe(false)
    expect(result.failures.join()).toContain('的原文中')
  })

  test('rejects a stale note hash', async () => {
    const { state, doc } = await makeDoc({ inputs: { note_sha256: 'deadbeef' } })
    const result = await importEvolutionDoc(doc, state)
    expect(result.ok).toBe(false)
    expect(result.failures.join()).toContain('note_sha256')
  })

  test('rejects a run older than the newest imported run', async () => {
    const { state, doc } = await makeDoc()
    const newer = await importEvolutionDoc(doc, state)
    const withNewer = appReducer(state, {
      type: 'import-evolution',
      bundles: newer.bundles,
      snapshot: newer.snapshot,
      at: '2026-11-17T07:00:00.000Z',
    })
    const fresh = await makeDoc()
    const older = {
      ...fresh.doc,
      run_id: 'run-test-old',
      analyzed_at: '2026-11-16T00:00:00.000Z',
      snapshot: {
        ...(fresh.doc.snapshot as TasteEvolutionSnapshot),
        run_id: 'run-test-old',
        snapshot_id: 'snap_test_old',
      },
    }
    const result = await importEvolutionDoc(older, withNewer)
    expect(result.ok).toBe(false)
    expect(result.failures.join()).toContain('早于已导入的最新运行')
  })

  test('is idempotent for the same run id', async () => {
    const { state, doc } = await makeDoc()
    const first = await importEvolutionDoc(doc, state)
    const imported = appReducer(state, {
      type: 'import-evolution',
      bundles: first.bundles,
      snapshot: first.snapshot,
      at: '2026-11-17T07:00:00.000Z',
    })
    const again = await importEvolutionDoc(doc, imported)
    expect(again.ok).toBe(true)
    expect(again.alreadyImported).toBe(true)
    expect(again.bundles).toHaveLength(0)
  })

  test('imported observation wins over the locally derived one', async () => {
    const { state, doc } = await makeDoc()
    const result = await importEvolutionDoc(doc, state)
    const imported = appReducer(state, {
      type: 'import-evolution',
      bundles: result.bundles,
      snapshot: result.snapshot,
      at: '2026-11-17T07:00:00.000Z',
    })
    const evolution = computeEvolution(imported, FILMS)
    const observation = evolution.observations.find((item) => item.observation_id === 'obs_thematic')
    expect(observation?.confidence).toBe(0.42)
    expect(observation?.evidence[0].source).toBe('deepworks')
    expect(evolution.latestRunId).toBe('run-test-a')
  })

  test('a failed import never removes the last good snapshot', async () => {
    const { state, doc } = await makeDoc()
    const first = await importEvolutionDoc(doc, state)
    const imported = appReducer(state, {
      type: 'import-evolution',
      bundles: first.bundles,
      snapshot: first.snapshot,
      at: '2026-11-17T07:00:00.000Z',
    })
    const broken = await makeDoc()
    ;(broken.doc.evidence as TasteEvolutionEvidence[])[0].original_quote = '不在原文里的句子'
    const result = await importEvolutionDoc(broken.doc, imported)
    expect(result.ok).toBe(false)
    const after = appReducer(imported, {
      type: 'import-evolution',
      bundles: result.bundles,
      snapshot: result.snapshot,
      at: '2026-11-17T08:00:00.000Z',
    })
    expect(after.tasteSnapshots).toHaveLength(imported.tasteSnapshots.length)
  })
})
