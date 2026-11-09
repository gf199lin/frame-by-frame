import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './app.ts'
import { RateLimiter } from './core/rateLimit.ts'
import { ProviderError, type AIProvider } from './core/provider.ts'
import { HISTORY_IDS, NOTE, validAnalysis } from './core/__fixtures__/analyses.ts'

const ENV = {
  AI_PROVIDER: 'deepseek',
  DEEPSEEK_API_KEY: 'test-key',
  AI_MODEL: 'deepseek-chat',
  ALLOWED_ORIGINS: 'http://localhost:5173',
}

const fakeProvider = (text: string | (() => string)): AIProvider => ({
  name: 'fake',
  model: 'fake-1',
  async complete() {
    return {
      text: typeof text === 'function' ? text() : text,
      provider: 'fake',
      model: 'fake-1',
    }
  },
})

const body = () => ({
  film: { id: 'film-a', title: '测试电影', year: 2020, director: '某人' },
  rating: 4,
  watchedAt: '2026-11-01',
  note: NOTE,
  history: HISTORY_IDS.map((id) => ({ id, title: `Film ${id}`, year: 2019, rating: 4 })),
})

const post = (payload: unknown, headers: Record<string, string> = {}) =>
  new Request('http://local/v1/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })

test('health reports configuration without leaking the key', async () => {
  const app = createApp({ env: ENV, providerFactory: () => fakeProvider('{}') })
  const response = await app(new Request('http://local/health'))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.configured, true)
  assert.equal(payload.model, 'deepseek-chat')
  assert.equal(JSON.stringify(payload).includes('test-key'), false)
})

test('a valid request returns the validated analysis and provenance', async () => {
  const app = createApp({
    env: ENV,
    providerFactory: () => fakeProvider(JSON.stringify(validAnalysis())),
  })
  const response = await app(post(body()))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.analysis.preference_evidence.length, 3)
  assert.equal(payload.meta.provider, 'fake')
  assert.equal(payload.meta.promptVersion, 'fbf-ai-1.0.0')
})

test('CORS echoes only the allowed origin', async () => {
  const app = createApp({
    env: ENV,
    providerFactory: () => fakeProvider(JSON.stringify(validAnalysis())),
  })
  const allowed = await app(
    new Request('http://local/health', { headers: { origin: 'http://localhost:5173' } }),
  )
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  const denied = await app(
    new Request('http://local/health', { headers: { origin: 'https://evil.example' } }),
  )
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})

test('rejects a note that has no user words', async () => {
  const app = createApp({ env: ENV, providerFactory: () => fakeProvider('{}') })
  const payload = body()
  payload.note = '不想写'
  const response = await app(post(payload))
  assert.equal(response.status, 400)
  const result = await response.json()
  assert.equal(result.error.code, 'BAD_REQUEST')
})

test('rejects invalid JSON', async () => {
  const app = createApp({ env: ENV, providerFactory: () => fakeProvider('{}') })
  const response = await app(
    new Request('http://local/v1/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    }),
  )
  assert.equal(response.status, 400)
})

test('refuses to store an analysis that never passes schema validation', async () => {
  const app = createApp({
    env: ENV,
    providerFactory: () => fakeProvider('{"summary":"太短"}'),
  })
  const response = await app(post(body()))
  assert.equal(response.status, 422)
  const payload = await response.json()
  assert.equal(payload.error.code, 'INVALID_MODEL_OUTPUT')
})

test('maps provider timeouts to 504 and retryable errors', async () => {
  const app = createApp({
    env: ENV,
    providerFactory: () => ({
      name: 'fake',
      model: 'fake-1',
      async complete() {
        throw new ProviderError('timeout', 'timed out')
      },
    }),
  })
  const response = await app(post(body()))
  assert.equal(response.status, 504)
  const payload = await response.json()
  assert.equal(payload.error.code, 'UPSTREAM_TIMEOUT')
  assert.equal(payload.error.retryable, true)
})

test('returns 503 when no model credentials exist', async () => {
  const app = createApp({ env: { AI_PROVIDER: 'deepseek' }, providerFactory: () => fakeProvider('{}') })
  const health = await app(new Request('http://local/health'))
  assert.equal((await health.json()).configured, false)
  const response = await app(post(body()))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED')
})

test('rate limits repeated requests from one client', async () => {
  const limiter = new RateLimiter()
  const now = Date.now()
  for (let index = 0; index < 12; index += 1) limiter.check('1.2.3.4', now)
  const app = createApp({
    env: ENV,
    limiter,
    providerFactory: () => fakeProvider(JSON.stringify(validAnalysis())),
  })
  const response = await app(post(body(), { 'x-real-ip': '1.2.3.4' }))
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers.get('retry-after')) > 0)
})

test('never writes the user note into structured logs', async () => {
  const lines: Array<Record<string, unknown>> = []
  const unique = '这是一段不应该进入日志的私人笔记，'.repeat(3)
  const app = createApp({
    env: ENV,
    log: (line) => lines.push(line),
    providerFactory: () => fakeProvider(JSON.stringify(validAnalysis())),
  })
  const payload = body()
  payload.note = unique
  const response = await app(post(payload))
  assert.equal(response.status, 200)
  const serialised = JSON.stringify(lines)
  assert.equal(serialised.includes(unique), false)
  assert.equal(serialised.includes('私人笔记'), false)
})

test('stub provider is refused unless explicitly allowed', async () => {
  const app = createApp({ env: { AI_PROVIDER: 'stub', ALLOW_STUB_PROVIDER: '0' } })
  const health = await app(new Request('http://local/health'))
  const payload = await health.json()
  assert.equal(payload.configured, false)
  assert.equal(payload.reason, 'stub_not_allowed')
})
