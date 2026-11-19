#!/usr/bin/env node
/**
 * Build the platform-document -> local KB entry mapping.
 *
 * Reads saved platform search transcripts (outputs/p2/agent-integration/runs/*.platform-search.json)
 * and derives, for every text chunk:
 *   knowledge_title (e.g. KB-003-emotion.md) -> kb_id (KB-003)
 *   body (text after "## 正文") -> sha256
 * then compares that hash with the local knowledge/entries.json entry text.
 *
 * Deliberately does NOT treat "similar text" as proof of identity:
 * a mapping is only marked consistent when the platform body hash equals the local
 * entry hash. Anything else is reported as an anomaly and must be reviewed by a human.
 *
 * Usage:
 *   node workflow/build-platform-map.mjs [--runs <dir>] [--out <file>]
 */
import { createHash, } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const runsDir = resolve(process.cwd(), option('--runs', 'outputs/p2/agent-integration/runs'))
const outPath = resolve(process.cwd(), option('--out', 'knowledge/platform-id-map.json'))

const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex')
const bodyOf = (content) => {
  const marker = content.indexOf('## 正文')
  const body = marker >= 0 ? content.slice(marker + '## 正文'.length) : content
  return body.replace(/^\s*\n/, '').trim()
}

const local = JSON.parse(readFileSync(resolve(process.cwd(), 'knowledge', 'entries.json'), 'utf8'))
const localById = new Map((local.entries ?? []).map((entry) => [entry.id, entry]))

const transcripts = readdirSync(runsDir).filter((name) => name.endsWith('.platform-search.json')).sort()
const acc = new Map()
const anomalies = []

for (const file of transcripts) {
  const payload = JSON.parse(readFileSync(join(runsDir, file), 'utf8'))
  const list = payload.data ?? payload.results ?? []
  for (const item of list) {
    if ((item.chunk_type ?? 'text') !== 'text') continue
    const title = String(item.knowledge_title ?? '')
    const match = title.match(/(KB-\d{3})/)
    if (!match) {
      anomalies.push({ file, reason: 'no kb_id in knowledge_title', knowledge_title: title })
      continue
    }
    const kbId = match[1]
    const bodyHash = sha256(bodyOf(String(item.content ?? '')))
    if (!acc.has(kbId)) {
      acc.set(kbId, {
        kb_id: kbId,
        platform_document_title: title,
        platform_chunk_ids: [],
        platform_chunk_hashes: [],
        observations: 0,
        transcripts: [],
      })
    }
    const row = acc.get(kbId)
    if (row.platform_document_title !== title) {
      anomalies.push({ file, kb_id: kbId, reason: 'document title changed across captures', seen: [row.platform_document_title, title] })
    }
    row.observations += 1
    if (!row.platform_chunk_ids.includes(String(item.id ?? ''))) row.platform_chunk_ids.push(String(item.id ?? ''))
    if (!row.platform_chunk_hashes.includes(bodyHash)) row.platform_chunk_hashes.push(bodyHash)
    if (!row.transcripts.includes(file)) row.transcripts.push(file)
  }
}

const entries = []
for (const [kbId, row] of [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const entry = localById.get(kbId)
  const localHash = entry ? sha256(entry.text) : null
  const bodyHashes = row.platform_chunk_hashes
  const consistent = Boolean(entry) && bodyHashes.length === 1 && bodyHashes[0] === localHash
  if (bodyHashes.length > 1) {
    anomalies.push({ kb_id: kbId, reason: 'platform returned multiple different bodies for one entry', hashes: bodyHashes })
  }
  if (!entry) {
    anomalies.push({ kb_id: kbId, reason: 'platform entry has no local counterpart' })
  } else if (bodyHashes.length === 1 && bodyHashes[0] !== localHash) {
    anomalies.push({ kb_id: kbId, reason: 'platform body hash differs from local entry text', platform: bodyHashes[0], local: localHash })
  }
  entries.push({
    kb_id: kbId,
    platform_document_title: row.platform_document_title,
    local_title: entry?.title ?? null,
    title_matches_kb_id: Boolean(entry) && row.platform_document_title.startsWith(kbId),
    platform_chunk_ids: row.platform_chunk_ids,
    platform_knowledge_ids: [],
    platform_body_sha256: bodyHashes.length === 1 ? bodyHashes[0] : bodyHashes,
    local_text_sha256: localHash,
    hash_consistent: consistent,
    observations: row.observations,
    source_transcripts: row.transcripts,
  })
}

const output = {
  mapping_version: '1.0.0',
  generated_at: new Date().toISOString(),
  generated_from: transcripts.map((name) => join(option('--runs', 'outputs/p2/agent-integration/runs'), name).replace(/\\/g, '/')),
  method: 'kb_id parsed from knowledge_title; identity requires platform body sha256 == local entry text sha256',
  limitations: [
    'platform knowledge_id (document level) was not captured in the P2-4 transcripts; platform_knowledge_ids is therefore empty and must be filled from a live capture.',
    'text similarity is never used as identity proof.',
  ],
  entries,
  anomalies,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8')

const summary = {
  ok: anomalies.length === 0,
  entries: entries.length,
  consistent: entries.filter((e) => e.hash_consistent).length,
  anomalies: anomalies.length,
  out: option('--out', 'knowledge/platform-id-map.json').replace(/\\/g, '/'),
}
console.log(JSON.stringify(summary, null, 2))
if (anomalies.length > 0) process.exitCode = 1
