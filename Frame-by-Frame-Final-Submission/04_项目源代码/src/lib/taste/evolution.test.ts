import { describe, expect, test } from 'vitest'
import type { AIFilmAnalysis, AppState, DimensionKey, Film, WatchRecord } from '@/types'
import { STORAGE_VERSION } from '@/data/taxonomy'
import { appReducer } from '@/store/AppStore'
import { appendSnapshot, compareSnapshots, computeEvolution } from './evolution'
import { computeTasteProfile } from '@/lib/ai/tasteProfile'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

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

const FILMS = ['f1', 'f2', 'f3', 'f4', 'f5'].map(film)
const AT = '2026-11-01T10:00:00.000Z'

const VISUAL_A = '我会先注意到构图和光线'
const VISUAL_B = '镜头移动比人物更先抓住我'
const VISUAL_C = '画面的颜色留在我脑子里'
const REVERSE = '我几乎没有留意镜头，只跟着人物走'

const note = (body: string): string => `${body}，这一段记忆比剧情本身更久。散场之后我还在想它。`

const record = (id: string, filmId: string, body: string, rating = 4): WatchRecord => ({
  id,
  filmId,
  rating,
  watchedAt: '2026-10-01',
  status: 'watched',
  reflection: note(body),
  themes: [],
  moods: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  source: 'user',
  ai: { summary: '', extractedFrom: 'backend', confidence: 0.5, status: 'complete' },
})

const claim = (
  dimension: DimensionKey,
  direction: 'low' | 'high' | 'neutral',
  quote: string,
  strength = 0.85,
  confidence = 0.8,
) => ({
  dimension_id: dimension,
  direction,
  strength,
  confidence,
  evidence: `AI reading for ${dimension}`,
  quote,
})

const analysis = (
  recordId: string,
  filmId: string,
  contributions: ReturnType<typeof claim>[],
  options: {
    verdict?: AIFilmAnalysis['review']['verdict']
    analyzedAt?: string
    confidence?: number
  } = {},
): AIFilmAnalysis => ({
  schemaVersion: 1,
  recordId,
  filmId,
  status: 'complete',
  summary: 'summary',
  observed_emotions: [],
  themes_identified: [],
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
    provider: 'deepworks',
    model: 'test-model',
    promptVersion: 'test',
    analyzedAt: options.analyzedAt ?? AT,
  },
  review: { verdict: options.verdict ?? 'accepted', updatedAt: AT },
  agent: { provider: 'deepworks', run_id: 'run-test-01' },
})

const baseState = (records: WatchRecord[], analyses: AIFilmAnalysis[]): AppState => ({
  version: STORAGE_VERSION,
  records,
  feedback: {},
  timelineFeedback: {},
  customFilms: [],
  corrections: [],
  yearbookGenerations: [],
  analyses,
  profileHistory: [],
  observationFeedback: [],
  tasteSnapshots: [],
  agentObservations: [],
  settings: { allowAiNotes: true },
})

const visualObservation = (state: AppState) =>
  computeEvolution(state, FILMS).observations.find((item) => item.observation_id === 'obs_visual')

/* ------------------------------------------------------------------ */
/*  T1 – T3: evidence accumulation and contradiction                   */
/* ------------------------------------------------------------------ */

describe('observation formation', () => {
  test('T1 — a first film forms only an emerging observation', () => {
    const state = baseState(
      [record('r1', 'f1', VISUAL_A)],
      [analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)])],
    )
    const observation = visualObservation(state)
    expect(observation).toBeDefined()
    expect(observation?.current_stage).toBe('emerging')
    expect(observation?.confidence).toBeLessThan(0.4)
    expect(observation?.evidence[0].original_quote).toBe(VISUAL_A)
    expect(observation?.description).toContain('不足以称为稳定的审美偏好')
  })

  test('T2 — a second similar film is recognised as repeated evidence', () => {
    const state = baseState(
      [
        record('r1', 'f1', VISUAL_A),
        record('r2', 'f2', VISUAL_B),
      ],
      [
        analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)]),
        analysis('r2', 'f2', [claim('visual', 'high', VISUAL_B)], {
          analyzedAt: '2026-11-02T10:00:00.000Z',
        }),
      ],
    )
    const observation = visualObservation(state)
    expect(observation?.evidence_count).toBe(2)
    expect(observation?.record_count).toBe(2)
    expect(observation?.supporting_record_ids).toEqual(
      expect.arrayContaining(['r1', 'r2']),
    )
    expect(observation?.current_stage).toBe('emerging')
  })

  test('T3 — a third film with opposite evidence is marked as contradicting', () => {
    const state = baseState(
      [
        record('r1', 'f1', VISUAL_A),
        record('r2', 'f2', VISUAL_B),
        record('r3', 'f3', REVERSE, 2),
      ],
      [
        analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)]),
        analysis('r2', 'f2', [claim('visual', 'high', VISUAL_B)], {
          analyzedAt: '2026-11-02T10:00:00.000Z',
        }),
        analysis('r3', 'f3', [claim('visual', 'low', REVERSE, 0.9, 0.85)], {
          analyzedAt: '2026-11-03T10:00:00.000Z',
        }),
      ],
    )
    const observation = visualObservation(state)
    expect(observation?.contradicting_evidence_ids).toHaveLength(1)
    expect(observation?.supporting_evidence_ids).toHaveLength(2)
    expect(observation?.current_stage).toBe('evolving')
    expect(
      observation?.evidence.find((item) => item.film_id === 'f3')?.polarity,
    ).toBe('contradicting')
  })

  test('a paraphrased quote is excluded instead of being shown as the user words', () => {
    const state = baseState(
      [record('r1', 'f1', VISUAL_A)],
      [analysis('r1', 'f1', [claim('visual', 'high', '你非常在意摄影')])],
    )
    const result = computeEvolution(state, FILMS)
    expect(result.observations).toHaveLength(0)
    expect(result.unverifiedEvidenceCount).toBe(1)
  })

  test('a removed individual claim stops supporting the observation', () => {
    const removed = claim('visual', 'high', VISUAL_A)
    const withRemoved = analysis('r1', 'f1', [{ ...removed }])
    withRemoved.preference_evidence[0].userStatus = 'removed'
    const state = baseState([record('r1', 'f1', VISUAL_A)], [withRemoved])
    expect(computeEvolution(state, FILMS).observations).toHaveLength(0)
  })

  test('five strong independent films can reach established without skipping the ladder', () => {
    const build = (id: string, filmId: string, body: string): WatchRecord => {
      const base = record(id, filmId, body, 5)
      return {
        ...base,
        // A long, specific note raises evidence quality without inventing a claim.
        reflection: `${base.reflection}${'这段描述解释了画面如何留住我。'.repeat(40)}`,
      }
    }
    const records = [
      build('r1', 'f1', VISUAL_A),
      build('r2', 'f2', VISUAL_B),
      build('r3', 'f3', VISUAL_C),
      build('r4', 'f4', VISUAL_A),
      build('r5', 'f5', VISUAL_B),
    ]
    const analyses = records.map((item, index) =>
      analysis(item.id, item.filmId, [claim('visual', 'high', item.reflection.slice(0, 10), 1, 1)], {
        analyzedAt: `2026-11-0${index + 1}T10:00:00.000Z`,
        confidence: 1,
      }),
    )
    const state = baseState(records, analyses)
    const observation = visualObservation(state)
    expect(observation?.current_stage).toBe('established')
    expect(observation?.confidence).toBeGreaterThanOrEqual(0.62)
  })
})

/* ------------------------------------------------------------------ */
/*  T4 – T7: feedback changes the analysis                             */
/* ------------------------------------------------------------------ */

describe('observation feedback', () => {
  const twoFilmState = () => {
    const state = baseState(
      [
        record('r1', 'f1', VISUAL_A),
        record('r2', 'f2', VISUAL_B),
      ],
      [
        analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)]),
        analysis('r2', 'f2', [claim('visual', 'high', VISUAL_B)], {
          analyzedAt: '2026-11-02T10:00:00.000Z',
        }),
      ],
    )
    return appReducer(state, {
      type: 'ensure-snapshot',
      films: FILMS,
      at: '2026-11-03T10:00:00.000Z',
    })
  }

  const feedback = (
    state: AppState,
    decision: 'accepted' | 'partially_accepted' | 'rejected' | 'unsure',
    comment?: string,
  ) =>
    appReducer(state, {
      type: 'set-observation-feedback',
      observationId: 'obs_visual',
      decision,
      comment,
      at: '2026-11-04T10:00:00.000Z',
      films: FILMS,
      snapshotId: state.tasteSnapshots[0]?.snapshot_id ?? 'none',
    })

  test('T4 — accepted feedback is recorded and raises confidence', () => {
    const state = twoFilmState()
    const before = visualObservation(state)?.confidence ?? 0
    const next = feedback(state, 'accepted')
    const observation = visualObservation(next)
    expect(observation?.accepted_feedback_count).toBe(1)
    expect(observation?.confidence).toBeGreaterThan(before)
    expect(next.observationFeedback).toHaveLength(1)
    expect(next.tasteSnapshots.length).toBe(state.tasteSnapshots.length + 1)
  })

  test('T5 — partially accepted keeps the claim but lowers confidence and keeps the correction', () => {
    const state = twoFilmState()
    const accepted = feedback(state, 'accepted')
    const partial = feedback(state, 'partially_accepted', '我注意的是表演，不是摄影。')
    const observation = visualObservation(partial)
    expect(observation?.partially_accepted_feedback_count).toBe(1)
    expect(observation?.latest_feedback?.user_comment).toBe('我注意的是表演，不是摄影。')
    expect(observation?.confidence).toBeLessThan(visualObservation(accepted)?.confidence ?? 1)
    expect(partial.tasteSnapshots[0].corrections_applied.join(' ')).toContain(
      '我注意的是表演，不是摄影。',
    )
  })

  test('T6 — rejected feedback withdraws the observation from the profile', () => {
    const state = twoFilmState()
    const beforeProfile = computeTasteProfile(state, FILMS).dimensions.find(
      (item) => item.key === 'visual',
    )
    const next = feedback(state, 'rejected')
    const observation = visualObservation(next)
    expect(observation?.effective).toBe(false)
    expect(observation?.confidence).toBeLessThanOrEqual(0.05)
    expect(observation?.description).toContain('不再作为有效支持证据')
    expect(next.tasteSnapshots[0].observations[0].effective).toBe(false)
    const afterProfile = computeTasteProfile(next, FILMS).dimensions.find(
      (item) => item.key === 'visual',
    )
    expect(afterProfile?.confidence).toBeLessThan((beforeProfile?.confidence ?? 0) * 0.5)
  })

  test('T7 — unsure never adds acceptance weight', () => {
    const state = twoFilmState()
    const before = visualObservation(state)?.confidence ?? 0
    const next = feedback(state, 'unsure')
    const observation = visualObservation(next)
    expect(observation?.confidence).toBeCloseTo(before, 6)
    expect(observation?.unsure_feedback_count).toBe(1)
    expect(observation?.accepted_feedback_count).toBe(0)
  })

  test('identical feedback is not counted twice', () => {
    const state = twoFilmState()
    const once = feedback(state, 'accepted', '是')
    const twice = feedback(once, 'accepted', '是')
    expect(twice).toBe(once)
    expect(twice.observationFeedback).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ */
/*  T8 – T11: edits, deletion, idempotency, failures                   */
/* ------------------------------------------------------------------ */

describe('data lifecycle', () => {
  const oneFilmState = () => {
    const state = baseState(
      [record('r1', 'f1', VISUAL_A)],
      [analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)])],
    )
    return appReducer(state, {
      type: 'ensure-snapshot',
      films: FILMS,
      at: '2026-11-02T10:00:00.000Z',
    })
  }

  test('T8 — editing the note invalidates the old reading, keeps the snapshot', () => {
    const state = oneFilmState()
    const edited = {
      ...state.records[0],
      reflection: note('这次我只记得演员的脸，没有注意镜头。'),
      updatedAt: '2026-11-05T10:00:00.000Z',
    }
    const next = appReducer(state, {
      type: 'upsert-record',
      record: edited,
      films: FILMS,
      at: '2026-11-05T10:00:00.000Z',
      filmTitle: 'Film f1',
    })
    expect(next.analyses[0].review.verdict).toBe('unreviewed')
    expect(computeEvolution(next, FILMS).observations).toHaveLength(0)
    expect(next.tasteSnapshots.length).toBe(state.tasteSnapshots.length + 1)
    expect(next.tasteSnapshots[1].snapshot_id).toBe(state.tasteSnapshots[0].snapshot_id)
    expect(next.profileHistory[0].reason).toContain('原始笔记')
  })

  test('T9 — deleting a film recomputes observations but keeps the old snapshot', () => {
    const state = oneFilmState()
    const next = appReducer(state, {
      type: 'delete-record',
      id: 'r1',
      at: '2026-11-06T10:00:00.000Z',
      films: FILMS,
      filmTitle: 'Film f1',
    })
    expect(next.records).toHaveLength(0)
    expect(computeEvolution(next, FILMS).observations).toHaveLength(0)
    expect(next.tasteSnapshots).toHaveLength(2)
    expect(next.tasteSnapshots[1].observations).toHaveLength(1)
    expect(next.tasteSnapshots[0].changes[0].kind).toBe('withdrawn')
  })

  test('T10 — the same analysis does not create duplicate evidence or snapshots', () => {
    const state = oneFilmState()
    const saved = state.analyses[0]
    const once = appReducer(state, {
      type: 'save-analysis',
      analysis: saved,
      films: FILMS,
      at: '2026-11-07T10:00:00.000Z',
    })
    expect(once.tasteSnapshots).toHaveLength(state.tasteSnapshots.length)
    const duplicated = computeEvolution(
      { ...state, analyses: [saved, saved] },
      FILMS,
    )
    expect(duplicated.observations[0].evidence_count).toBe(1)
    expect(duplicated.evidence).toHaveLength(1)
  })

  test('T11 — a failed run cannot overwrite the last valid snapshot', () => {
    const state = oneFilmState()
    const unchanged = appendSnapshot(state, FILMS, '2026-11-08T10:00:00.000Z')
    expect(unchanged).toBe(state)
    expect(unchanged.tasteSnapshots[0].snapshot_id).toBe(state.tasteSnapshots[0].snapshot_id)
    expect(unchanged.tasteSnapshots[0].observations).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ */
/*  T12: comparing two snapshots                                       */
/* ------------------------------------------------------------------ */

describe('snapshot history', () => {
  test('T12 — two snapshots can be compared and explain the change', () => {
    const first = appReducer(
      baseState(
        [record('r1', 'f1', VISUAL_A)],
        [analysis('r1', 'f1', [claim('visual', 'high', VISUAL_A)])],
      ),
      { type: 'ensure-snapshot', films: FILMS, at: '2026-11-02T10:00:00.000Z' },
    )
    const second = appReducer(first, {
      type: 'save-analysis',
      analysis: analysis('r2', 'f2', [claim('visual', 'high', VISUAL_B)], {
        analyzedAt: '2026-11-03T10:00:00.000Z',
      }),
      films: FILMS,
      at: '2026-11-03T10:00:00.000Z',
    })
    // The second record has to exist before its analysis is valid.
    const withRecord = appReducer(second, {
      type: 'upsert-record',
      record: record('r2', 'f2', VISUAL_B),
      films: FILMS,
      at: '2026-11-03T10:00:00.000Z',
      filmTitle: 'Film f2',
    })
    expect(withRecord.tasteSnapshots.length).toBeGreaterThanOrEqual(2)
    const latest = withRecord.tasteSnapshots[0]
    const previous =
      withRecord.tasteSnapshots.find((item) => item.snapshot_id !== latest.snapshot_id) ??
      withRecord.tasteSnapshots[1]
    const changes = compareSnapshots(previous, latest, 'obs_visual')
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe('updated')
    expect(changes[0].reason).toContain('新增 1 条支持证据')
    expect(changes[0].after_confidence).toBeGreaterThan(
      changes[0].before_confidence ?? 0,
    )
  })
})
