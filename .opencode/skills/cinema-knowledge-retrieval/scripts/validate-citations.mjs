#!/usr/bin/env node
/**
 * Quality gate for Cinema Knowledge Retrieval.
 * Ensures every citation points to a real KB entry and that excerpts are verbatim.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const has = (name) => args.includes(name)

const citationsPath = option('--citations')
const entriesPath = option('--entries', 'knowledge/entries.json')
const allowEmpty = has('--allow-empty')
if (!citationsPath) {
  console.error('Usage: node validate-citations.mjs --citations <draft.json> [--entries knowledge/entries.json] [--allow-empty]')
  process.exit(2)
}

const draft = JSON.parse(readFileSync(resolve(process.cwd(), citationsPath), 'utf8'))
const kb = JSON.parse(readFileSync(resolve(process.cwd(), entriesPath), 'utf8'))
const entries = new Map((kb.entries ?? []).map((entry) => [entry.id, entry]))
const citations = Array.isArray(draft.kb_citations) ? draft.kb_citations : []
const kbStatus = draft.kb_status

const failures = []
const warnings = []
const fail = (msg) => failures.push(msg)
const warn = (msg) => warnings.push(msg)

const normalize = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”‘’「」『』"]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()

if (kbStatus && !['cited', 'no_relevant_entry', 'unavailable'].includes(kbStatus)) {
  fail(`kb_status is invalid: "${kbStatus}"`)
}
if ((kbStatus === 'no_relevant_entry' || kbStatus === 'unavailable') && citations.length > 0) {
  fail(`kb_status=${kbStatus} but kb_citations is not empty`)
}
if (kbStatus === 'cited' && citations.length === 0) {
  fail('kb_status=cited but kb_citations is empty')
}
if (citations.length === 0 && !allowEmpty && kbStatus !== 'no_relevant_entry' && kbStatus !== 'unavailable') {
  fail('kb_citations is empty; pass --allow-empty only if the KB was genuinely irrelevant')
}
if (citations.length > 3) warn(`kb_citations has ${citations.length} items; prefer 0-3`)

const seen = new Set()
const checked = []
citations.forEach((citation, index) => {
  const where = `kb_citations[${index}]`
  const id = String(citation?.kb_id ?? '')
  const entry = entries.get(id)
  if (!entry) {
    fail(`${where}.kb_id does not exist: "${id}"`)
    return
  }
  if (seen.has(id)) fail(`${where}.kb_id is duplicated: "${id}"`)
  seen.add(id)

  if (String(citation.title ?? '') !== entry.title) {
    fail(`${where}.title does not match ${id}: "${citation.title ?? ''}"`)
  }
  if (String(citation.source ?? '') !== entry.source) {
    fail(`${where}.source does not match ${id}`)
  }
  const why = String(citation.why_relevant ?? '')
  if (!why.trim()) fail(`${where}.why_relevant is empty`)
  else if (why.length < 8) fail(`${where}.why_relevant is too short`)
  else if (why.length > 160) warn(`${where}.why_relevant is longer than 160 chars`)

  const excerpt = String(citation.excerpt ?? '')
  if (excerpt) {
    const entryText = normalize(entry.text)
    if (!entryText.includes(normalize(excerpt))) {
      fail(`${where}.excerpt is NOT a verbatim substring of ${id}`)
    }
    if (excerpt.length > 160) warn(`${where}.excerpt is longer than 160 chars`)
  } else {
    warn(`${where}.excerpt is empty; include a short verbatim excerpt when possible`)
  }

  checked.push({ kb_id: id, title: entry.title, excerpt_verbatim: Boolean(excerpt) })
})

const report = {
  ok: failures.length === 0,
  entries: entries.size,
  kb_status: kbStatus ?? '(not set)',
  citation_count: citations.length,
  checked,
  warnings,
  failures,
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
