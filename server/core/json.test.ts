import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractJson } from './json.ts'

test('parses a plain JSON object', () => {
  const result = extractJson('{"a":1}')
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, { a: 1 })
})

test('recovers JSON from a markdown fence', () => {
  const result = extractJson('这是结果：\n```json\n{"a":2}\n```\n谢谢')
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, { a: 2 })
})

test('recovers JSON surrounded by prose', () => {
  const result = extractJson('好的，分析如下 {"summary":"x"} 完毕')
  assert.equal(result.ok, true)
})

test('fails on an empty or unparseable completion', () => {
  assert.equal(extractJson('').ok, false)
  assert.equal(extractJson('no json here').ok, false)
  assert.equal(extractJson('{"a":}').ok, false)
})
