#!/usr/bin/env node
/**
 * SHA-256 evidence manifest for a Film Curator run.
 *
 * Records the integrity of every file that participates in the knowledge chain,
 * so a later reviewer can prove the evidence was not edited after the fact.
 *
 * Roles:
 *   platform_transcript  - Agent's transcription of the platform search response
 *   platform_results     - adapter output consumed by retrieve.mjs
 *   retrieval_result     - retrieve.mjs output (kb_provider, rejected[], kb_version)
 *   run_record           - the final run JSON itself
 *
 * Usage:
 *   node workflow/hash-manifest.mjs --run <final.json> --out <manifest.json>
 *   node workflow/hash-manifest.mjs --verify <manifest.json>
 *
 * Exit codes: 0 ok, 1 verification mismatch, 2 usage error, 3 unreadable file.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const sha256File = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const verifyPath = option('--verify')
if (verifyPath) {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), verifyPath), 'utf8'))
  const mismatches = []
  for (const entry of manifest.files ?? []) {
    const file = resolve(process.cwd(), entry.path)
    if (!existsSync(file)) {
      mismatches.push({ path: entry.path, reason: 'missing' })
      continue
    }
    const actual = sha256File(file)
    if (actual !== entry.sha256) mismatches.push({ path: entry.path, reason: 'sha256 mismatch', expected: entry.sha256, actual })
  }
  const ok = mismatches.length === 0
  console.log(JSON.stringify({ ok, manifest: verifyPath, checked: (manifest.files ?? []).length, mismatches }, null, 2))
  process.exit(ok ? 0 : 1)
}

const runPath = option('--run')
const outPath = option('--out')
if (!runPath) {
  console.error('Usage: node workflow/hash-manifest.mjs --run <final.json> --out <manifest.json> | --verify <manifest.json>')
  process.exit(2)
}

const run = JSON.parse(readFileSync(resolve(process.cwd(), runPath), 'utf8'))
const candidates = []
const push = (role, path) => {
  if (!path) return
  candidates.push({ role, path: String(path).replace(/\\/g, '/') })
}

const kbSource = run.retrieval_log?.kb_source
push('platform_results', kbSource)
if (kbSource) {
  push('platform_transcript', String(kbSource).replace(/\.platform-results\.json$/, '.platform-search.json'))
  push('retrieval_result', String(kbSource).replace(/\.platform-results\.json$/, '.retrieval.json'))
}
push('run_record', runPath)
for (const extra of run.retrieval_log?.evidence_files ?? []) push('failure_evidence', extra)

const files = []
for (const item of candidates) {
  const file = resolve(process.cwd(), item.path)
  if (!existsSync(file)) continue
  files.push({
    role: item.role,
    path: item.path,
    bytes: statSync(file).size,
    sha256: sha256File(file),
  })
}

const rootSeed = files.map((f) => `${f.role}:${f.sha256}`).sort().join('\n')
const manifest = {
  manifest_version: '1.0.0',
  generated_at: new Date().toISOString(),
  run_id: run.run_id,
  agent_id: run.agent_id,
  model: run.model,
  kb_provider: run.retrieval_log?.kb_provider ?? null,
  kb_status: run.kb_status ?? null,
  capture_method: run.retrieval_log?.capture_method ?? 'manual_transcription',
  capture_method_note:
    'manual_transcription means the Agent copied the platform response into a file; nothing here proves the copy is faithful. Only the verbatim gate over entry bodies provides partial assurance.',
  algorithm: 'sha256',
  root_sha256: createHash('sha256').update(rootSeed, 'utf8').digest('hex'),
  files,
}

if (outPath) {
  const file = resolve(process.cwd(), outPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}

console.log(JSON.stringify({
  ok: true,
  out: outPath ? String(outPath).replace(/\\/g, '/') : null,
  files: files.length,
  roles: files.map((f) => f.role),
  root_sha256: manifest.root_sha256,
}, null, 2))
