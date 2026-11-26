import { describe, expect, test } from 'vitest'
import { createInitialState } from '@/data/seed'
import { FILMS } from '@/data/films'
import { buildAgentInput } from '@/lib/taste/evolutionInput'
import { sha256Hex } from '@/lib/taste/evolutionImport'
import type { TasteObservationFeedback } from '@/types'

const rejected: TasteObservationFeedback = {
  feedback_id: 'fb_rejected_01',
  observation_id: 'obs_ending',
  decision: 'rejected',
  user_comment: '我不是不接受结局，我是不接受所有结局都被说成同一种。',
  created_at: '2026-11-17T05:00:00.000Z',
  affected_snapshot_id: 'snap_previous',
}

describe('agent input', () => {
  test('carries the note hash of the exact stored note', async () => {
    const state = createInitialState()
    const record = state.records.find((item) => item.id === 'rec_lalaland')!
    const input = await buildAgentInput(state, FILMS, 'rec_lalaland', 'run-input-test')
    expect(input?.note_sha256).toBe(await sha256Hex(record.reflection))
    expect(input?.note).toBe(record.reflection)
  })

  test('carries rejected feedback and its comment into the next run', async () => {
    const state = { ...createInitialState(), observationFeedback: [rejected] }
    const input = await buildAgentInput(state, FILMS, 'rec_lalaland', 'run-input-test')
    expect(input?.history.feedback).toHaveLength(1)
    const feedback = input?.history.feedback[0] as TasteObservationFeedback
    expect(feedback.decision).toBe('rejected')
    expect(feedback.user_comment).toContain('所有结局都被说成同一种')
    expect(input?.history.observations).toBeDefined()
  })
})
