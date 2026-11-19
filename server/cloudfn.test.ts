import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handler, toRequest, type CloudHttpResult } from './cloudfn.ts'

const decode = (result: CloudHttpResult): Record<string, unknown> =>
  JSON.parse(Buffer.from(result.body, 'base64').toString('utf8'))

const clearEnv = () => {
  delete process.env.AI_PROVIDER
  delete process.env.DEEPSEEK_API_KEY
  delete process.env.ALLOW_STUB_PROVIDER
  delete process.env.ALLOWED_ORIGINS
  delete process.env.PATH_PREFIX
  delete process.env.AI_DEBUG
}

const basePayload = (note: string) => ({
  film: { id: 'film-a', title: '测试电影', year: 2020 },
  rating: 4,
  note,
  history: [],
})

test('health event works without credentials and never leaks config values', async () => {
  clearEnv()
  process.env.AI_PROVIDER = 'deepseek'
  const result = await handler({
    httpMethod: 'GET',
    path: '/health',
    headers: { host: 'fn.test' },
  })
  assert.equal(result.statusCode, 200)
  assert.equal(result.isBase64Encoded, true)
  const body = decode(result)
  assert.equal(body.ok, true)
  assert.equal(body.configured, false)
  assert.equal(body.reason, 'missing_key')
  assert.equal(result.body.includes('sk-'), false)
})

test('CORS preflight passes through with the configured origin', async () => {
  clearEnv()
  process.env.AI_PROVIDER = 'stub'
  process.env.ALLOW_STUB_PROVIDER = '1'
  process.env.ALLOWED_ORIGINS = 'https://gf199lin.github.io'
  const result = await handler({
    httpMethod: 'OPTIONS',
    path: '/v1/analyze',
    headers: {
      host: 'fn.test',
      origin: 'https://gf199lin.github.io',
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(result.statusCode, 204)
  assert.equal(result.headers['access-control-allow-origin'], 'https://gf199lin.github.io')
  assert.equal(result.headers['access-control-allow-methods'], 'POST, GET, OPTIONS')
})

test('analysis without a key returns 503 instead of pretending to work', async () => {
  clearEnv()
  process.env.AI_PROVIDER = 'deepseek'
  const result = await handler({
    httpMethod: 'POST',
    path: '/v1/analyze',
    headers: { host: 'fn.test', 'content-type': 'application/json' },
    body: JSON.stringify(basePayload('这是一段足够长的个人观影笔记，用来触发请求校验。')),
  })
  assert.equal(result.statusCode, 503)
  const body = decode(result) as { error: { code: string } }
  assert.equal(body.error.code, 'AI_NOT_CONFIGURED')
})

test('base64 encoded bodies are decoded before validation', async () => {
  clearEnv()
  process.env.AI_PROVIDER = 'stub'
  process.env.ALLOW_STUB_PROVIDER = '1'
  const payload = basePayload('镜头很慢，画面安静，结尾让我想起很多事。')
  const result = await handler({
    httpMethod: 'POST',
    path: '/v1/analyze',
    isBase64Encoded: true,
    body: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
    headers: { host: 'fn.test', 'content-type': 'application/json' },
  })
  assert.equal(result.statusCode, 200)
  const body = decode(result) as {
    analysis: { preference_evidence: unknown[] }
    meta: { provider: string; model: string }
  }
  assert.ok(body.analysis.preference_evidence.length >= 1)
  assert.equal(body.meta.provider, 'stub-local-verification')
})

test('stage prefix from the gateway is stripped', async () => {
  clearEnv()
  process.env.PATH_PREFIX = '/release'
  process.env.AI_PROVIDER = 'deepseek'
  const result = await handler({
    httpMethod: 'GET',
    path: '/release/health',
    headers: { host: 'fn.test' },
  })
  assert.equal(result.statusCode, 200)
  assert.equal((decode(result) as { ok: boolean }).ok, true)
})

test('unknown routes return 404 and wrong methods return 405', async () => {
  clearEnv()
  process.env.AI_PROVIDER = 'deepseek'
  const missing = await handler({ httpMethod: 'GET', path: '/nope', headers: { host: 'fn.test' } })
  assert.equal(missing.statusCode, 404)

  const wrongMethod = await handler({
    httpMethod: 'GET',
    path: '/v1/analyze',
    headers: { host: 'fn.test' },
  })
  assert.equal(wrongMethod.statusCode, 405)
  assert.equal(wrongMethod.headers.allow, 'POST')
})

test('query parameters are forwarded into the request URL', () => {
  const request = toRequest({
    httpMethod: 'GET',
    path: '/health',
    queryStringParameters: { probe: '1' },
    headers: { host: 'fn.test' },
  })
  assert.equal(new URL(request.url).searchParams.get('probe'), '1')
})

test('a raw HTTP passthrough payload fails with a clear message', async () => {
  clearEnv()
  const result = await handler(Buffer.from('GET /health HTTP/1.1\r\nHost: x\r\n\r\n'))
  assert.equal(result.statusCode, 500)
  const body = decode(result) as { error: { message: string } }
  assert.match(body.error.message, /event function/)
})
