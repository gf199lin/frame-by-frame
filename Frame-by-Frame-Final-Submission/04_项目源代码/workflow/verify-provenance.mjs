#!/usr/bin/env node
/**
 * Provenance review for a knowledge-backed run.
 *
 * Checks three independent things and never merges them:
 *   1. integrity  - file hashes still match the manifest
 *   2. traceability - every cited kb_id maps to a platform document whose body hash
 *                     equals the local entry text hash (identity, not similarity)
 *   3. provenance - who captured what, how, and whether a human reviewed it
 *
 * A pass here means "the evidence is internally consistent".
 * It does NOT mean "the film analysis is correct".
 *
 * Usage:
 *   node workflow/verify-provenance.mjs --run <final.json> --manifest <manifest.json> \
 *     [--map knowledge/platform-id-map.json] [--provenance <provenance.json>]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const runPath = option('--run')
const manifestPath = option('--manifest')
if (!runPath || !manifestPath) {
  console.error('Usage: node workflow/verify-provenance.mjs --run <final.json> --manifest <manifest.json>')
  process.exit(2)
}

const run = JSON.parse(readFileSync(resolve(process.cwd(), runPath), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), 'utf8'))
const mapPath = option('--map', 'knowledge/platform-id-map.json')
const map = existsSync(resolve(process.cwd(), mapPath))
  ? JSON.parse(readFileSync(resolve(process.cwd(), mapPath), 'utf8'))
  : { entries: [] }
const provPath = option('--provenance')
const provenance = provPath && existsSync(resolve(process.cwd(), provPath))
  ? JSON.parse(readFileSync(resolve(process.cwd(), provPath), 'utf8'))
  : null

const failures = []
const warnings = []
const sha256File = (file) => createHash('sha256').update(readFileSync(resolve(process.cwd(), file))).digest('hex')

// 1. integrity
const mismatches = []
for (const entry of manifest.files ?? []) {
  const file = resolve(process.cwd(), entry.path)
  if (!existsSync(file)) {
    mismatches.push({ path: entry.path, reason: 'missing' })
    continue
  }
  const actual = sha256File(entry.path)
  if (actual !== entry.sha256) mismatches.push({ path: entry.path, reason: 'sha256 mismatch' })
}
if (mismatches.length > 0) failures.push(`manifest integrity failed for ${mismatches.length} file(s)`)

// 2. traceability
const mapById = new Map((map.entries ?? []).map((entry) => [entry.kb_id, entry]))
const citations = Array.isArray(run.kb_citations) ? run.kb_citations : []
const traced = citations.map((citation) => {
  const mapped = mapById.get(String(citation.kb_id ?? ''))
  if (!mapped) {
    failures.push(`citation ${citation.kb_id} is not present in the platform mapping`)
    return { kb_id: citation.kb_id, traced: false, reason: 'not in platform map' }
  }
  if (!mapped.hash_consistent) {
    failures.push(`citation ${citation.kb_id} maps to a platform document whose body hash differs from the local entry`)
  }
  if (!mapped.platform_chunk_ids?.length) {
    warnings.push(`citation ${citation.kb_id} has no recorded platform chunk id`)
  }
  return {
    kb_id: citation.kb_id,
    traced: Boolean(mapped.hash_consistent),
    platform_document_title: mapped.platform_document_title,
    platform_chunk_ids: mapped.platform_chunk_ids ?? [],
    body_sha256: mapped.platform_body_sha256,
  }
})

const kbStatus = String(run.kb_status ?? '')
if (kbStatus === 'no_relevant_entry' && citations.length > 0) {
  failures.push('no_relevant_entry must not carry citations')
}
if (kbStatus === 'unavailable' && citations.length > 0) {
  failures.push('unavailable must not carry citations')
}
if (kbStatus === 'cited' && citations.length === 0) {
  failures.push('cited requires at least one citation')
}

// 3. provenance
const captureMethod = String(provenance?.capture_method ?? run.retrieval_log?.capture_method ?? '')
if (!captureMethod) failures.push('capture_method is missing')
if (captureMethod && captureMethod !== 'auto_capture' && captureMethod !== 'manual_transcription') {
  failures.push(`capture_method has an unknown value: "${captureMethod}"`)
}
if (captureMethod === 'manual_transcription') {
  warnings.push('evidence was manually transcribed; provenance rests on human review plus the verbatim body gate')
}
const reviewStatus = provenance?.review_status ?? 'pending'
if (reviewStatus !== 'approved') {
  warnings.push(`human provenance review is "${reviewStatus}", not "approved"`)
}
for (const key of ['run_id', 'capture_time', 'reviewer', 'reviewed_files', 'review_notes']) {
  if (provenance && provenance[key] === undefined) warnings.push(`provenance.${key} is missing`)
}

const report = {
  ok: failures.length === 0,
  run: runPath.replace(/\\/g, '/'),
  manifest: manifestPath.replace(/\\/g, '/'),
  run_id: run.run_id,
  layers: {
    integrity: { checked: (manifest.files ?? []).length, mismatches },
    traceability: { cited: citations.length, traced: traced.filter((t) => t.traced).length, details: traced },
    provenance: {
      capture_method: captureMethod || null,
      review_status: reviewStatus,
      reviewer: provenance?.reviewer ?? null,
    },
    business: {
      kb_status: kbStatus,
      citations: citations.length,
      outcome: kbStatus === 'cited'
        ? 'analysis_completed_with_kb_support'
        : kbStatus === 'no_relevant_entry'
          ? 'analysis_completed_without_kb_support'
          : kbStatus === 'unavailable'
            ? 'blocked_kb_unavailable'
            : 'unknown',
    },
  },
  warnings,
  failures,
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
