#!/usr/bin/env node
/**
 * Build knowledge/index.json from knowledge/entries.json.
 * This is a deterministic integrity check, not an embedding index.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const entriesPath = resolve(root, 'knowledge', 'entries.json')
const outPath = resolve(root, 'knowledge', 'index.json')

const kb = JSON.parse(readFileSync(entriesPath, 'utf8'))
const entries = Array.isArray(kb.entries) ? kb.entries : []

const seen = new Set()
const errors = []
const indexEntries = entries.map((entry) => {
  const id = String(entry.id ?? '').trim()
  if (!id) errors.push('entry without id')
  if (seen.has(id)) errors.push(`duplicate id: ${id}`)
  seen.add(id)
  for (const field of ['title', 'domain', 'source', 'license', 'text']) {
    if (!entry[field] || typeof entry[field] !== 'string') {
      errors.push(`${id || '(no id)'} missing ${field}`)
    }
  }
  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    errors.push(`${id || '(no id)'} missing tags`)
  }
  return {
    id,
    title: entry.title,
    domain: entry.domain,
    tags: entry.tags ?? [],
    source: entry.source,
    license: entry.license,
    chars: String(entry.text ?? '').length,
  }
})

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}

const index = {
  version: kb.version ?? '1.0.0',
  name: kb.name,
  description: kb.description,
  license: kb.license,
  built_at: new Date().toISOString(),
  count: indexEntries.length,
  entries: indexEntries,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n', 'utf8')

console.log(
  JSON.stringify(
    {
      ok: true,
      count: index.count,
      ids: indexEntries.map((e) => e.id),
      out: 'knowledge/index.json',
    },
    null,
    2,
  ),
)
