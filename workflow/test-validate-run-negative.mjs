#!/usr/bin/env node
/**
 * Negative controls for workflow/validate-run.mjs.
 *
 * A gate that never rejects anything is not a gate. Each case mutates a known-good
 * run record in memory, writes a temp file, runs the real validator, and asserts
 * the expected verdict.
 *
 * Usage: node workflow/test-validate-run-negative.mjs
 * Exit: 0 all cases behaved as expected, 1 at least one case did not.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const read = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
const C = read('outputs/p2/agent-integration/runs/fbf-p24-C-20261116-01.json')
const D = read('outputs/p2/p2-5/runs/D.json')
const tmp = mkdtempSync(join(tmpdir(), 'fbf-neg-'))

const cases = [
  // positive control: C must now be accepted as a legitimate terminal state
  {
    name: 'C-no_relevant_entry-accepted',
    run: C,
    input: 'outputs/p2/agent-integration/inputs/run-p24-C.json',
    expected: 'pass',
  },
  // negative: no_relevant_entry carrying a citation is a contradiction
  {
    name: 'no_relevant_entry-with-citation',
    run: { ...C, kb_citations: [{ kb_id: 'KB-005', title: 'x', source: 'y', excerpt: '景别决定观众离人物有多近。', why_relevant: 'z' }] },
    input: 'outputs/p2/agent-integration/inputs/run-p24-C.json',
    expected: 'fail',
  },
  // negative: no_relevant_entry produced by a local fallback hides the missing platform
  {
    name: 'no_relevant_entry-from-local-fallback',
    run: { ...C, retrieval_log: { ...C.retrieval_log, fallback_used: true } },
    input: 'outputs/p2/agent-integration/inputs/run-p24-C.json',
    expected: 'fail',
  },
  // negative: unavailable without real failure evidence is an unsupported claim
  {
    name: 'unavailable-without-evidence',
    run: { ...D, retrieval_log: { ...D.retrieval_log, unavailable_evidence: '' } },
    input: 'outputs/p2/p2-5/inputs/D.json',
    expected: 'fail',
  },
  // negative: unavailable silently falling back to the local KB
  {
    name: 'unavailable-with-silent-fallback',
    run: { ...D, retrieval_log: { ...D.retrieval_log, fallback_used: true } },
    input: 'outputs/p2/p2-5/inputs/D.json',
    expected: 'fail',
  },
  // negative: an unknown kb_status must not slip through
  {
    name: 'unknown-kb_status',
    run: { ...D, kb_status: 'skipped', kb_citations: [] },
    input: 'outputs/p2/p2-5/inputs/D.json',
    expected: 'fail',
  },
]

const results = cases.map((c) => {
  const file = join(tmp, `${c.name}.json`)
  writeFileSync(file, JSON.stringify(c.run, null, 2), 'utf8')
  const proc = spawnSync(process.execPath, [
    'workflow/validate-run.mjs', '--run', file, '--input', c.input,
  ], { cwd: process.cwd(), encoding: 'utf8' })
  let parsed = null
  try { parsed = JSON.parse(proc.stdout) } catch { /* ignore */ }
  const pass = c.expected === 'pass' ? proc.status === 0 : proc.status !== 0
  return {
    name: c.name,
    expected: c.expected,
    exit_code: proc.status,
    pass,
    business_outcome: parsed?.business_outcome ?? null,
    failures: parsed?.failures ?? [],
  }
})

const ok = results.every((r) => r.pass)
console.log(JSON.stringify({ ok, total: results.length, results }, null, 2))
process.exit(ok ? 0 : 1)
