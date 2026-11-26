#!/usr/bin/env node
/**
 * Cinema taste profiling, schema v2.
 *
 * Key semantics:
 * - evidence_count: accepted evidence records actually used
 * - independent_note_count: unique note_id count
 * - duplicate_evidence_count: exact duplicate evidence removed
 * - duplicate_note_count: duplicate note submissions
 * - sample_size: deprecated alias of evidence_count (kept for v1 readers)
 *
 * Same-note evidence is aggregated inside the note first, then across notes.
 * Unobserved dimensions are NOT neutral preferences.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PROFILE_THRESHOLDS, PROFILE_SCHEMA_VERSION } from './profile-thresholds.mjs'
import { computeNoteId, detectDuplicateNotes, movieIdentity } from '../../../lib/note-identity.mjs'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const collect = (name) => {
  const out = []
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith('--')) {
      out.push(args[i + 1])
    }
  }
  return out
}

const evidencePaths = collect('--evidence').flatMap((p) => p.split(',')).filter(Boolean)
const outPath = option('--out')
const priorPath = option('--prior')
if (evidencePaths.length === 0) {
  console.error('Usage: node profile.mjs --evidence <draft.json> [--evidence <draft2.json>] [--out profile.json]')
  process.exit(2)
}

const DIMENSIONS = ['narrative', 'emotion', 'thematic', 'visual', 'character', 'ending']
// AI Core v1.0.0 four-value direction.
//   high/low      -> directional pull (+1 / -1)
//   ambivalent    -> both directions present in the same axis (net 0)
//   neutral       -> the note explicitly reports no pull on this axis (net 0)
// neutral still counts as an observation, so the axis becomes `observed` at
// score 50 with lean `balanced`; it must never be confused with `unobserved`.
const DIR = { high: 1, low: -1, ambivalent: 0, neutral: 0 }
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

const drafts = evidencePaths.map((p) => {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
  return { path: p, data: parsed }
})

const notes = []
const keptEvidence = []
const duplicateEvidence = []
const seenEvidence = new Set()
let missingIdentityCount = 0

for (let i = 0; i < drafts.length; i += 1) {
  const draft = drafts[i].data
  const film = draft.film ?? {}
  const note = draft.note ?? ''
  if (movieIdentity(film) === 'identity_missing') missingIdentityCount += 1
  const noteId = draft.note_id
    || (note ? computeNoteId(film, note, { recordId: draft.record_id ?? draft.viewing_id ?? draft.recordId, inputIndex: i }) : draft.note_sha256 ? `sha256:${String(draft.note_sha256).replace(/^sha256:/, '')}` : `unknown-note-${i}`)
  const semantic = draft.semantic_status ?? null
  const allEvidence = (draft.preference_evidence ?? []).filter((e) => e.accepted !== false)
  const kept = []
  for (const e of allEvidence) {
    const sig = `${noteId}|${e.dimension_id}|${e.direction}|${String(e.quote ?? '').replace(/\s+/g, '')}`
    if (seenEvidence.has(sig)) {
      duplicateEvidence.push({ note_id: noteId, dimension_id: e.dimension_id, quote: e.quote })
      continue
    }
    seenEvidence.add(sig)
    kept.push({ ...e, __note_id: noteId })
  }
  notes.push({
    note_id: noteId,
    semantic_status: semantic,
    evidence_count: kept.length,
    source: drafts[i].path,
  })
  keptEvidence.push(...kept)
}

// Only clearly relevant notes feed the taste profile. Legacy drafts without
// semantic_status are treated as relevant for backward compatibility.
const includedNotes = notes.filter((n) => n.semantic_status === null || n.semantic_status === 'relevant')
const includedIds = new Set(includedNotes.map((n) => n.note_id))
const excludedNotes = notes
  .filter((n) => !includedIds.has(n.note_id))
  .map((n) => ({ note_id: n.note_id, semantic_status: n.semantic_status, reason: n.semantic_status === 'unrelated' ? 'semantic_unrelated' : n.semantic_status === 'narrative_only' ? 'narrative_only' : 'semantic_uncertain' }))

const usedEvidence = keptEvidence.filter((e) => includedIds.has(e.__note_id))

// Per-note, per-dimension aggregation.
const noteDim = new Map()
for (const e of usedEvidence) {
  const dir = DIR[e.direction]
  if (dir === undefined) continue
  const weight = Number(e.strength ?? 0) * Number(e.confidence ?? 0)
  if (!(weight > 0)) continue
  if (!noteDim.has(e.__note_id)) noteDim.set(e.__note_id, new Map())
  const dims = noteDim.get(e.__note_id)
  if (!dims.has(e.dimension_id)) dims.set(e.dimension_id, { wsum: 0, dsum: 0 })
  const agg = dims.get(e.dimension_id)
  agg.wsum += weight
  agg.dsum += weight * dir
}

const dimensions = {}
for (const key of DIMENSIONS) {
  const noteMeans = []
  let evCount = 0
  for (const [noteId, dims] of noteDim) {
    if (!includedIds.has(noteId)) continue
    const agg = dims.get(key)
    if (!agg) continue
    evCount += usedEvidence.filter((e) => e.__note_id === noteId && e.dimension_id === key).length
    noteMeans.push(agg.dsum / agg.wsum)
  }
  const noteCount = noteMeans.length
  const neutralCount = usedEvidence.filter(
    (e) => includedIds.has(e.__note_id) && e.dimension_id === key && e.direction === 'neutral',
  ).length
  const ambivalentCount = usedEvidence.filter(
    (e) => includedIds.has(e.__note_id) && e.dimension_id === key && e.direction === 'ambivalent',
  ).length
  if (noteCount === 0) {
    dimensions[key] = {
      status: 'unobserved',
      score: null,
      lean: 'unknown',
      confidence: 0,
      evidence_count: 0,
      note_count: 0,
      sufficient: false,
      neutral_default: false,
      neutral_evidence_count: 0,
      ambivalent_evidence_count: 0,
    }
    continue
  }
  const avgDir = noteMeans.reduce((a, b) => a + b, 0) / noteCount
  const score = round(Math.max(0, Math.min(100, 50 + 50 * avgDir)), 1)
  const confidence = round(Math.min(0.9, 0.15 * noteCount), 2)
  dimensions[key] = {
    status: 'observed',
    score,
    lean: avgDir > 0.05 ? 'high' : avgDir < -0.05 ? 'low' : 'balanced',
    confidence,
    evidence_count: evCount,
    note_count: noteCount,
    sufficient: noteCount >= PROFILE_THRESHOLDS.dimensionMinNotes,
    neutral_default: false,
    neutral_evidence_count: neutralCount,
    ambivalent_evidence_count: ambivalentCount,
  }
}

const independentNoteCount = includedIds.size
const observedDimensions = DIMENSIONS.filter((k) => dimensions[k].note_count > 0)
const sufficientDimensions = DIMENSIONS.filter((k) => dimensions[k].sufficient)
const sufficient = independentNoteCount >= PROFILE_THRESHOLDS.overallMinNotes
  && observedDimensions.length >= PROFILE_THRESHOLDS.overallMinDimensions
  && sufficientDimensions.length >= PROFILE_THRESHOLDS.overallMinSufficientDimensions
const provisional = !sufficient
const provisionalReasons = []
if (independentNoteCount < PROFILE_THRESHOLDS.overallMinNotes) {
  provisionalReasons.push(`independent_note_count < ${PROFILE_THRESHOLDS.overallMinNotes}`)
}
if (observedDimensions.length < PROFILE_THRESHOLDS.overallMinDimensions) {
  provisionalReasons.push(`observed_dimensions < ${PROFILE_THRESHOLDS.overallMinDimensions}`)
}
if (sufficientDimensions.length < PROFILE_THRESHOLDS.overallMinSufficientDimensions) {
  provisionalReasons.push(`sufficient_dimensions < ${PROFILE_THRESHOLDS.overallMinSufficientDimensions}`)
}

const observedConfidence = observedDimensions.length
  ? observedDimensions.reduce((sum, k) => sum + dimensions[k].confidence, 0) / observedDimensions.length
  : 0
const overallConfidence = round(observedConfidence * Math.min(1, independentNoteCount / PROFILE_THRESHOLDS.overallMinNotes), 2)

const duplicateNoteInfo = detectDuplicateNotes(notes.map((n) => ({ note_id: n.note_id, note_sha256: null })))
const duplicateNoteCount = duplicateNoteInfo.duplicate_note_count

const correctionsApplied = []
for (const d of drafts) {
  const list = d.data.corrections_applied
  if (Array.isArray(list)) correctionsApplied.push(...list)
  for (const e of d.data.preference_evidence ?? []) {
    if (e.accepted === false) correctionsApplied.push(`excluded:${e.dimension_id}:${e.quote}`)
  }
}

const warnings = []
if (provisional) warnings.push(`provisional profile: ${provisionalReasons.join('; ')}`)
const unobserved = DIMENSIONS.filter((k) => dimensions[k].status === 'unobserved')
if (unobserved.length) warnings.push(`unobserved dimensions (not neutral preferences): ${unobserved.join(', ')}`)
if (duplicateEvidence.length) warnings.push(`duplicate evidence removed: ${duplicateEvidence.length}`)
if (duplicateNoteCount) warnings.push(`duplicate note submissions: ${duplicateNoteCount}`)
if (missingIdentityCount) warnings.push(`identity_missing: ${missingIdentityCount} notes use run-local ids; cross-run dedupe unavailable`)

const profile = {
  schema_version: PROFILE_SCHEMA_VERSION,
  method: 'weighted-evidence-shrinkage-v2',
  evidence_count: usedEvidence.length,
  independent_note_count: independentNoteCount,
  sufficient_dimensions: sufficientDimensions.length,
  identity_missing_count: missingIdentityCount,
  duplicate_evidence_count: duplicateEvidence.length,
  duplicate_note_count: duplicateNoteCount,
  duplicate_notes: duplicateNoteInfo.duplicate_notes,
  sample_size: usedEvidence.length,
  sample_size_semantics: 'deprecated alias of evidence_count',
  sufficient,
  insufficient_samples: !sufficient,
  provisional,
  provisional_reasons: provisionalReasons,
  overall_confidence: overallConfidence,
  dimensions,
  notes_used: includedNotes.map((n) => ({ note_id: n.note_id, semantic_status: n.semantic_status, evidence_count: n.evidence_count })),
  excluded_notes: excludedNotes,
  corrections_applied: correctionsApplied,
  warnings,
}

if (priorPath) {
  const prior = JSON.parse(readFileSync(resolve(process.cwd(), priorPath), 'utf8'))
  const delta = {}
  for (const k of DIMENSIONS) {
    const from = prior?.dimensions?.[k]?.score ?? null
    const to = dimensions[k].score
    delta[k] = { from, to, delta: from === null || to === null ? null : round(to - from, 1) }
  }
  profile.delta_vs_prior = delta
}

const json = JSON.stringify(profile, null, 2)
console.log(json)
if (outPath) {
  const file = resolve(process.cwd(), outPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, json + '\n', 'utf8')
}
