import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter } from './rateLimit.ts'

test('allows twelve requests per minute and blocks the thirteenth', () => {
  const limiter = new RateLimiter()
  const now = 1_700_000_000_000
  for (let index = 0; index < 12; index += 1) {
    const decision = limiter.check('client', now + index)
    assert.equal(decision.ok, true)
  }
  const blocked = limiter.check('client', now + 20)
  assert.equal(blocked.ok, false)
  if (!blocked.ok) {
    assert.equal(blocked.reason, 'minute')
    assert.ok(blocked.retryAfterSec >= 1)
  }
})

test('slides the window forward', () => {
  const limiter = new RateLimiter()
  const start = 1_700_000_000_000
  for (let index = 0; index < 12; index += 1) limiter.check('client', start + index)
  const later = limiter.check('client', start + 61_000)
  assert.equal(later.ok, true)
})

test('limits separate clients independently', () => {
  const limiter = new RateLimiter()
  const now = 1_700_000_000_000
  for (let index = 0; index < 12; index += 1) limiter.check('a', now)
  assert.equal(limiter.check('b', now).ok, true)
})
