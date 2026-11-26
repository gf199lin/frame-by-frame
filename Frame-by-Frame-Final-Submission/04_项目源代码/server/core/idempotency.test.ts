import test from 'node:test'
import assert from 'node:assert/strict'
import { IdempotencyRegistry } from './idempotency.ts'

test('a new key creates a queued run', () => {
  const registry = new IdempotencyRegistry(1000, () => 'run_fixed')
  const result = registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 0 })
  assert.equal(result.reused, false)
  assert.equal(result.record.runId, 'run_fixed')
  assert.equal(result.record.status, 'queued')
})

test('the same idempotency key reuses the original run', () => {
  const registry = new IdempotencyRegistry(1000, () => 'run_fixed')
  const first = registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 0 })
  const second = registry.reserve({ key: 'idem_1', requestId: 'req_2', now: 10 })
  assert.equal(second.reused, true)
  assert.equal(second.record.runId, first.record.runId)
  assert.equal(registry.size, 1)
})

test('a repeated request id with a new key reuses the original run', () => {
  const registry = new IdempotencyRegistry(1000, () => 'run_fixed')
  const first = registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 0 })
  const second = registry.reserve({ key: 'idem_2', requestId: 'req_1', now: 10 })
  assert.equal(second.reused, true)
  assert.equal(second.record.runId, first.record.runId)
})

test('status transitions are recorded', () => {
  const registry = new IdempotencyRegistry(1000, () => 'run_fixed')
  registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 0 })
  assert.equal(registry.updateStatus('run_fixed', 'succeeded'), true)
  assert.equal(registry.get('idem_1')?.status, 'succeeded')
  assert.equal(registry.updateStatus('run_missing', 'failed'), false)
})

test('expired records are pruned and can be reused', () => {
  let seq = 0
  const registry = new IdempotencyRegistry(1000, () => `run_${++seq}`)
  registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 0 })
  const later = registry.reserve({ key: 'idem_1', requestId: 'req_1', now: 2000 })
  assert.equal(later.reused, false)
  assert.equal(later.record.runId, 'run_2')
})
