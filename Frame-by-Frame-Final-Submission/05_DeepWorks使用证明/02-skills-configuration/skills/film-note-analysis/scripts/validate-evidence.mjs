#!/usr/bin/env node
/**
 * Quality gate for Film Note Analysis.
 * Rejects evidence whose quote is not a verbatim (or quote-normalized) substring
 * of the user's note, and checks the structural contract.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { checkSemantic } from './semantic-check.mjs'
import { computeNoteId } from '../../../lib/note-identity.mjs'

const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const inputPath = option('--input')
const analysisPath = option('--analysis')
if (!inputPath || !analysisPath) {
  console.error('Usage: node validate-evidence.mjs --input <input.json> --analysis <draft.json>')
  process.exit(2)
}

const input = JSON.parse(readFileSync(resolve(process.cwd(), inputPath), 'utf8'))
const draft = JSON.parse(readFileSync(resolve(process.cwd(), analysisPath), 'utf8'))
const note = String(input.note ?? '')
const analysis = draft.analysis ?? {}
const evidence = Array.isArray(draft.preference_evidence) ? draft.preference_evidence : []

const DIMENSIONS = new Set(['narrative', 'emotion', 'thematic', 'visual', 'character', 'ending'])
const MOODS = new Set([
  'melancholy', 'tender', 'wistful', 'hopeful', 'restrained', 'cathartic',
  'uneasy', 'awe', 'warmth', 'longing', 'playful', 'quiet',
])
const THEMES = new Set([
  'memory', 'loss', 'grief', 'identity', 'love', 'ambition', 'freedom',
  'family', 'hope', 'loneliness', 'art', 'time', 'reality', 'friendship',
  'coming-of-age', 'forgiveness', 'sacrifice', 'justice',
])
const EVIDENCE_TYPES = new Set(['user_quote', 'inference'])
const DIRECTIONS = new Set(['high', 'low', 'ambivalent'])

const failures = []
const warnings = []
const matches = []
const fail = (msg) => failures.push(msg)
const warn = (msg) => warnings.push(msg)

const normalize = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”‘’「」『』"]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()

const countCjk = (value) => (String(value ?? '').match(/[\u4e00-\u9fff]/g) ?? []).length
const noteNormalized = normalize(note)

const semantic = checkSemantic({ note, film: input.film ?? {} })
const computedNoteId = computeNoteId(input.film ?? {}, note)
if (draft.note_id && draft.note_id !== computedNoteId) {
  fail(`draft.note_id does not match input film + note: "${draft.note_id}"`)
}
if (semantic.status !== 'relevant') {
  warn(`semantic_status=${semantic.status}; profile updates should be limited (${semantic.reasons.join(', ')})`)
}

if (!note.trim()) fail('input.note is empty')
if (evidence.length === 0) fail('preference_evidence is empty')
if (evidence.length > 8) warn(`preference_evidence has ${evidence.length} items; keep it focused (3-6 recommended)`)

const seenQuotes = new Set()
const dimensionsUsed = new Set()

evidence.forEach((item, index) => {
  const where = `preference_evidence[${index}]`
  const dimension = String(item?.dimension_id ?? '')
  const direction = String(item?.direction ?? '')
  const evidenceType = String(item?.evidence_type ?? '')
  const quote = String(item?.quote ?? '')
  const interpretation = String(item?.interpretation ?? '')

  if (!DIMENSIONS.has(dimension)) fail(`${where}.dimension_id is invalid: "${dimension}"`)
  else dimensionsUsed.add(dimension)
  if (!DIRECTIONS.has(direction)) fail(`${where}.direction is invalid: "${direction}"`)
  if (!EVIDENCE_TYPES.has(evidenceType)) fail(`${where}.evidence_type is invalid: "${evidenceType}"`)
  if (!Number.isFinite(item?.strength) || item.strength < 0 || item.strength > 1) {
    fail(`${where}.strength must be a number in [0,1]`)
  }
  if (!Number.isFinite(item?.confidence) || item.confidence < 0 || item.confidence > 1) {
    fail(`${where}.confidence must be a number in [0,1]`)
  }
  if (!interpretation.trim()) fail(`${where}.interpretation is empty`)
  if (interpretation.length > 160) warn(`${where}.interpretation is longer than 160 chars`)

  if (!quote.trim()) {
    fail(`${where}.quote is empty; every evidence item needs a verbatim quote`)
    return
  }
  if (countCjk(quote) < 6) fail(`${where}.quote is too short (need >= 6 CJK chars): "${quote}"`)

  const quoteNormalized = normalize(quote)
  let matchType = 'none'
  if (note.includes(quote)) matchType = 'exact'
  else if (quoteNormalized && noteNormalized.includes(quoteNormalized)) matchType = 'normalized'
  if (matchType === 'none') {
    fail(`${where}.quote is NOT found in the user's note: "${quote}"`)
  } else {
    matches.push({ index, dimension_id: dimension, quote, match_type: matchType })
  }

  if (seenQuotes.has(quoteNormalized)) fail(`${where}.quote duplicates another evidence item`)
  seenQuotes.add(quoteNormalized)
})

if (dimensionsUsed.size < 3) {
  fail(`only ${dimensionsUsed.size} distinct dimensions covered; need at least 3`)
}

if (!String(analysis.summary ?? '').trim()) fail('analysis.summary is empty')
if (String(analysis.summary ?? '').length > 200) warn('analysis.summary is longer than 200 chars')
if (!Number.isFinite(analysis.confidence) || analysis.confidence < 0 || analysis.confidence > 1) {
  fail('analysis.confidence must be a number in [0,1]')
}

const emotions = Array.isArray(analysis.observed_emotions) ? analysis.observed_emotions : []
if (emotions.length === 0) fail('analysis.observed_emotions is empty')
emotions.forEach((item, index) => {
  if (!MOODS.has(String(item?.mood ?? ''))) fail(`analysis.observed_emotions[${index}].mood is invalid`)
  if (!String(item?.evidence ?? '').trim()) fail(`analysis.observed_emotions[${index}].evidence is empty`)
})

const themes = Array.isArray(analysis.themes_identified) ? analysis.themes_identified : []
if (themes.length === 0) fail('analysis.themes_identified is empty')
themes.forEach((item, index) => {
  if (!THEMES.has(String(item?.theme ?? ''))) fail(`analysis.themes_identified[${index}].theme is invalid`)
  if (!String(item?.evidence ?? '').trim()) fail(`analysis.themes_identified[${index}].evidence is empty`)
})

const uncertainties = Array.isArray(draft.uncertainties) ? draft.uncertainties : []
if (uncertainties.length === 0) fail('uncertainties must contain at least one item')

const report = {
  ok: failures.length === 0,
  input: inputPath,
  analysis: analysisPath,
  note_chars: note.length,
  note_sha256: createHash('sha256').update(note, 'utf8').digest('hex'),
  note_id: computedNoteId,
  semantic_status: semantic.status,
  semantic_reasons: semantic.reasons,
  semantic_signals: semantic.signals,
  evidence_count: evidence.length,
  distinct_dimensions: [...dimensionsUsed],
  matches,
  warnings,
  failures,
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
