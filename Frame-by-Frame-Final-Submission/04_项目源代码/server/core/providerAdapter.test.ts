import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTE, validAnalysis, validResponse } from './__fixtures__/analyses.ts'
import {
  DeepWorksAdapter,
  LegacyDeepSeekAdapter,
  ProviderNotConfiguredError,
  createProviderAdapter,
  type AnalysisProviderAdapter,
} from './providerAdapter.ts'
import type { AIProvider } from './provider.ts'
import type { AnalyzeRequest } from './types.ts'

const request: AnalyzeRequest = {
  film: { id: 'film-1', title: 'Manchester by the Sea', year: 2016 },
  rating: 4.5,
  note: NOTE,
  history: [
    { id: 'film-b', title: 'B', year: 2015, rating: 4 },
    { id: 'film-c', title: 'C', year: 2014, rating: 4 },
  ],
  locale: 'zh-CN',
}

const fakeProvider = (): AIProvider => ({
  name: 'deepseek',
  model: 'deepseek-chat',
  complete: async () => ({
    text: JSON.stringify(validAnalysis()),
    provider: 'deepseek',
    model: 'deepseek-chat',
  }),
})

test('the legacy adapter labels results as legacy-deepseek', async () => {
  const adapter = new LegacyDeepSeekAdapter(true)
  const result = await adapter.analyze(request, {
    provider: fakeProvider(),
    now: () => new Date('2026-11-10T00:00:00.000Z'),
  })
  assert.equal(result.meta.providerId, 'legacy-deepseek')
  assert.equal(result.meta.provider, 'deepseek')
  assert.ok(result.analysis.summary.length > 0)
})

test('the legacy adapter keeps the existing response shape', async () => {
  const adapter = new LegacyDeepSeekAdapter(true)
  const result = await adapter.analyze(request, {
    provider: fakeProvider(),
    now: () => new Date('2026-11-10T00:00:00.000Z'),
  })
  assert.deepEqual(result.analysis, validResponse().analysis)
})

test('the DeepWorks adapter is explicitly unconfigured', () => {
  const adapter = new DeepWorksAdapter()
  const descriptor = adapter.describe()
  assert.equal(descriptor.id, 'deepworks')
  assert.equal(descriptor.configured, false)
  assert.ok(descriptor.reason)
})

test('the DeepWorks adapter never fabricates a result', async () => {
  const adapter: AnalysisProviderAdapter = new DeepWorksAdapter()
  await assert.rejects(
    () => adapter.analyze(request, { provider: fakeProvider() }),
    (error: unknown) => error instanceof ProviderNotConfiguredError,
  )
})

test('the factory only selects DeepWorks when asked for it', () => {
  assert.equal(createProviderAdapter({ provider: 'deepseek' }).id, 'legacy-deepseek')
  assert.equal(createProviderAdapter({ provider: undefined }).id, 'legacy-deepseek')
  assert.equal(createProviderAdapter({ provider: 'deepworks' }).id, 'deepworks')
})
