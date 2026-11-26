import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './app.ts'
import type { AIProvider } from './core/provider.ts'
import { HISTORY_IDS, NOTE, validAnalysis } from './core/__fixtures__/analyses.ts'

const ENV = {
  AI_PROVIDER: 'deepseek',
  DEEPSEEK_API_KEY: 'test-key',
  AI_MODEL: 'deepseek-chat',
  ALLOWED_ORIGINS: 'http://localhost:5173',
}

const legacyProvider = (): AIProvider => ({
  name: 'deepseek',
  model: 'deepseek-chat',
  async complete() {
    return {
      text: JSON.stringify(validAnalysis()),
      provider: 'deepseek',
      model: 'deepseek-chat',
    }
  },
})

const body = (extra: Record<string, unknown> = {}) => ({
  film: { id: 'film-a', title: '测试电影', year: 2020, director: '某人' },
  rating: 4,
  watchedAt: '2026-11-01',
  note: NOTE,
  history: HISTORY_IDS.map((id) => ({ id, title: `Film ${id}`, year: 2019, rating: 4 })),
  ...extra,
})

const post = (payload: unknown) =>
  new Request('http://local/v1/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

test('a request with record_id receives an agent-run.v2 alongside the legacy fields', async () => {
  const app = createApp({ env: ENV, providerFactory: legacyProvider })
  const response = await app(
    post(body({ record_id: 'rec_1', request_id: 'req_1' })),
  )
  assert.equal(response.status, 200)
  const payload = await response.json()

  // Legacy fields are untouched.
  assert.equal(payload.analysis.preference_evidence.length, 3)
  assert.equal(payload.meta.provider, 'deepseek')

  // v2 run.
  assert.equal(payload.run.schema_version, 2)
  assert.equal(payload.run.record_id, 'rec_1')
  assert.equal(payload.run.request_id, 'req_1')
  assert.equal(payload.run.provider, 'legacy-deepseek')
  assert.equal(payload.run.film_id, 'film-a')
  assert.equal(payload.run.status, 'succeeded')
  assert.deepEqual(payload.run.skills_used, [])
  assert.deepEqual(payload.run.kb_citations, [])
  assert.deepEqual(payload.run.quality_gates, {})
  assert.match(payload.run.run_id, /^run_/)
})

test('a request without record_id keeps the old response shape', async () => {
  const app = createApp({ env: ENV, providerFactory: legacyProvider })
  const response = await app(post(body()))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.run, undefined)
  assert.ok(payload.analysis.summary.length > 0)
})

test('an unknown provider name is not promoted to DeepWorks', async () => {
  const app = createApp({
    env: ENV,
    providerFactory: () => ({
      name: 'fake',
      model: 'fake-1',
      complete: async () => ({
        text: JSON.stringify(validAnalysis()),
        provider: 'fake',
        model: 'fake-1',
      }),
    }),
  })
  const payload = await (await app(post(body({ record_id: 'rec_2' })))).json()
  assert.equal(payload.run.provider, 'unknown')
})

test('validation errors carry a request_id', async () => {
  const app = createApp({ env: ENV, providerFactory: legacyProvider })
  const payload = body({ record_id: 'rec_3', request_id: 'req_bad', note: '太短' })
  const response = await app(post(payload))
  assert.equal(response.status, 400)
  const result = await response.json()
  assert.equal(result.error.code, 'BAD_REQUEST')
  assert.equal(result.error.request_id, 'req_bad')
})

test('a generated request_id is returned when the caller sends none', async () => {
  const app = createApp({ env: ENV, providerFactory: legacyProvider })
  const payload = await (await app(post(body({ record_id: 'rec_4' })))).json()
  assert.match(payload.run.request_id, /^req_/)
})
