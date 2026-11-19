#!/usr/bin/env node
/**
 * Adapter: DeepWorks platform KB search payload -> retrieve.mjs platform-results format.
 *
 * Input is a transcript of a REAL DeepWorks platform search call (`sass_search`)
 * saved as JSON:
 *   { "kb_id": "...", "query": "...", "project_space_id": "...", "captured_at": "...", "data": [ ... ] }
 * or a bare array of platform chunk records.
 *
 * This script calls NO endpoint and invents NO knowledge. It only:
 *   1. derives the entry id from `knowledge_title` (KB-00X-*.md) or the `<!-- kb_id: -->` marker;
 *   2. keeps the document body verbatim (text after `## 正文`) for text chunks;
 *   3. drops platform-generated summaries (`chunk_type: "summary"`) because they are
 *      derived text, not the original entry body, and must never be cited as excerpt;
 *   4. de-duplicates by kb_id so retrieve.mjs does not reject a duplicate.
 *
 * Output is consumed by:
 *   node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs \
 *     --provider platform --platform-results <out> --no-fallback
 *
 * retrieve.mjs still re-verifies every excerpt verbatim against knowledge/entries.json.
 * If this adapter misreads or the platform rewrote text, that gate fails loudly.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const searchPath = option('--search')
const outPath = option('--out')
const overrideQuery = option('--query')
const overrideKbId = option('--kb-id')

if (!searchPath) {
  console.error('Usage: node from-platform-search.mjs --search <platform-search.json> [--out <platform-results.json>]')
  process.exit(2)
}

const payload = JSON.parse(readFileSync(resolve(process.cwd(), searchPath), 'utf8'))
const rawList = Array.isArray(payload)
  ? payload
  : Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.results)
      ? payload.results
      : null
if (!rawList) {
  console.error('platform search file must be an array or { data: [] } / { results: [] }')
  process.exit(3)
}

const KB_ID_IN_TITLE = /(KB-\d{3})/
const KB_ID_IN_BODY = /<!--\s*kb_id:\s*(KB-\d{3})\s*-->/

const entryIdOf = (item, content) => {
  const title = String(item?.knowledge_title ?? item?.knowledge_filename ?? '')
  const fromTitle = title.match(KB_ID_IN_TITLE)
  if (fromTitle) return fromTitle[1]
  const fromBody = content.match(KB_ID_IN_BODY)
  return fromBody ? fromBody[1] : null
}

// Keep only the original body; the platform chunk also carries an ID header and metadata list.
const bodyOf = (content) => {
  const marker = content.indexOf('## 正文')
  const body = marker >= 0 ? content.slice(marker + '## 正文'.length) : content
  return body.replace(/^\s*\n/, '').trim()
}

const dropped = []
const byId = new Map()

for (const item of rawList) {
  const content = String(item?.content ?? item?.text ?? '')
  const kbId = entryIdOf(item, content)
  const chunkType = String(item?.chunk_type ?? 'text')
  if (!content.trim()) {
    dropped.push({ kb_id: kbId ?? '', reason: 'empty content' })
    continue
  }
  if (!kbId) {
    dropped.push({ kb_id: '', reason: 'no kb_id in knowledge_title or body marker' })
    continue
  }
  if (chunkType !== 'text') {
    dropped.push({ kb_id: kbId, chunk_type: chunkType, reason: 'derived chunk (summary/question), not original entry text' })
    continue
  }
  const excerpt = bodyOf(content)
  if (!excerpt) {
    dropped.push({ kb_id: kbId, reason: 'empty body after ## 正文' })
    continue
  }
  const candidate = {
    kb_id: kbId,
    knowledge_title: String(item?.knowledge_title ?? ''),
    platform_chunk_id: String(item?.id ?? ''),
    platform_knowledge_id: String(item?.knowledge_id ?? ''),
    chunk_type: chunkType,
    score: typeof item?.score === 'number' ? item.score : null,
    excerpt,
  }
  const previous = byId.get(kbId)
  if (previous) {
    dropped.push({ kb_id: kbId, reason: 'duplicate kb_id in platform payload (kept highest score)' })
    if ((candidate.score ?? -1) <= (previous.score ?? -1)) continue
  }
  byId.set(kbId, candidate)
}

const results = [...byId.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
if (results.length === 0) {
  console.error('no usable text chunk in platform payload; refusing to emit an empty platform export')
  process.exit(4)
}

const output = {
  kb_id: overrideKbId ?? String(payload?.kb_id ?? payload?.knowledge_base_id ?? ''),
  kb_provider: 'platform',
  source_tool: 'sass_search',
  project_space_id: String(payload?.project_space_id ?? ''),
  captured_at: String(payload?.captured_at ?? ''),
  query: overrideQuery ?? String(payload?.query ?? ''),
  transcript: searchPath,
  results,
  dropped,
  stats: { returned_chunks: rawList.length, kept_entries: results.length, dropped_chunks: dropped.length },
}

const json = JSON.stringify(output, null, 2)
if (outPath) {
  const file = resolve(process.cwd(), outPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, json + '\n', 'utf8')
}
console.log(JSON.stringify({ ok: true, out: outPath ?? null, ...output.stats, kept: results.map((r) => r.kb_id) }, null, 2))
