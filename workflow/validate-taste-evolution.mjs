#!/usr/bin/env node
/**
 * Validate a Taste Evolution agent output (taste-evolution.v1).
 *
 * Usage:
 *   node workflow/validate-taste-evolution.mjs --input <evolution.json> [--note-file <note.txt>] [--out <report.json>]
 *
 * Exit code 0 means ok:true. Any failure is printed and exits 1.
 * This script never invents or repairs data; it only checks the contract.
 */
import fs from 'node:fs'
import path from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i]
  if (!token.startsWith('--')) continue
  const key = token.slice(2)
  const value = process.argv[i + 1]
  if (value && !value.startsWith('--')) {
    args[key] = value
    i += 1
  } else {
    args[key] = true
  }
}

if (!args.input) {
  console.error('missing --input <evolution.json>')
  process.exit(2)
}

const DIMENSIONS = new Set(['narrative', 'emotion', 'thematic', 'visual', 'character', 'ending'])
const STAGES = new Set(['emerging', 'developing', 'established', 'evolving'])
const POLARITIES = new Set(['supporting', 'contradicting', 'neutral'])
const DECISIONS = new Set(['accepted', 'partially_accepted', 'rejected', 'unsure'])
const CHANGE_KINDS = new Set(['created', 'updated', 'unchanged', 'withdrawn'])

const failures = []
const fail = (message) => failures.push(message)
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0
const isNumber01 = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
const isIdArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)

const normalise = (text) =>
  String(text)
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`cannot read JSON ${file}: ${error.message}`)
    process.exit(2)
  }
}

const doc = readJson(args.input)
const note = typeof args['note-file'] === 'string' ? normalise(fs.readFileSync(args['note-file'], 'utf8')) : null

// Cross-record runs cite quotes from several films. --records-file supplies the
// real notes keyed by record_id so each quote is checked against its own note
// instead of one film's text.
let notesByRecord = null
if (typeof args['records-file'] === 'string') {
  const records = readJson(args['records-file'])
  if (!Array.isArray(records)) {
    console.error('--records-file must contain a JSON array')
    process.exit(2)
  }
  notesByRecord = new Map()
  for (const item of records) {
    if (isObject(item) && isText(item.record_id) && typeof item.note === 'string') {
      notesByRecord.set(item.record_id, item.note)
    }
  }
}

const noteFor = (recordId) => {
  if (notesByRecord) {
    return isText(recordId) && notesByRecord.has(recordId)
      ? normalise(notesByRecord.get(recordId))
      : null
  }
  return note
}

if (!isObject(doc)) fail('root must be an object')
else {
  if (doc.schema_version !== 'taste-evolution.v1') fail('schema_version must be "taste-evolution.v1"')
  if (!isText(doc.run_id)) fail('run_id is required')
  if (!isText(doc.record_id)) fail('record_id is required')
  if (!isText(doc.film_id)) fail('film_id is required')

  const observations = Array.isArray(doc.observations) ? doc.observations : []
  const evidence = Array.isArray(doc.evidence) ? doc.evidence : []
  const feedback = Array.isArray(doc.feedback_applied) ? doc.feedback_applied : []
  if (!Array.isArray(doc.observations)) fail('observations must be an array')
  if (!Array.isArray(doc.evidence)) fail('evidence must be an array')
  if (!isObject(doc.snapshot)) fail('snapshot is required')

  const observationIds = new Set()
  for (const [index, observation] of observations.entries()) {
    const label = `observations[${index}]`
    if (!isObject(observation)) {
      fail(`${label} must be an object`)
      continue
    }
    if (!isText(observation.observation_id)) fail(`${label}.observation_id is required`)
    else if (observationIds.has(observation.observation_id)) fail(`${label}.observation_id is duplicated`)
    else observationIds.add(observation.observation_id)
    if (!DIMENSIONS.has(observation.dimension)) fail(`${label}.dimension is invalid`)
    if (!isText(observation.title)) fail(`${label}.title is required`)
    if (!isText(observation.description)) fail(`${label}.description is required`)
    if (!STAGES.has(observation.current_stage)) fail(`${label}.current_stage is invalid`)
    if (!isNumber01(observation.confidence)) fail(`${label}.confidence must be 0..1`)
    if (!isText(observation.first_observed_at)) fail(`${label}.first_observed_at is required`)
    if (!isText(observation.last_updated_at)) fail(`${label}.last_updated_at is required`)
    if (!isIdArray(observation.supporting_record_ids)) fail(`${label}.supporting_record_ids must be string[]`)
    if (!isIdArray(observation.supporting_evidence_ids)) fail(`${label}.supporting_evidence_ids must be string[]`)
    if (!isIdArray(observation.contradicting_evidence_ids)) fail(`${label}.contradicting_evidence_ids must be string[]`)
    if (!Number.isInteger(observation.accepted_feedback_count) || observation.accepted_feedback_count < 0) {
      fail(`${label}.accepted_feedback_count must be a non-negative integer`)
    }
    if (!Number.isInteger(observation.rejected_feedback_count) || observation.rejected_feedback_count < 0) {
      fail(`${label}.rejected_feedback_count must be a non-negative integer`)
    }
    if (!Array.isArray(observation.history)) fail(`${label}.history must be an array`)
    if (
      observation.current_stage === 'emerging' &&
      observation.confidence >= 0.62
    ) {
      fail(`${label} is emerging but confidence >= 0.62; label the stage honestly`)
    }
  }

  const evidenceById = new Map()
  for (const [index, item] of evidence.entries()) {
    const label = `evidence[${index}]`
    if (!isObject(item)) {
      fail(`${label} must be an object`)
      continue
    }
    if (!isText(item.evidence_id)) fail(`${label}.evidence_id is required`)
    else if (evidenceById.has(item.evidence_id)) fail(`${label}.evidence_id is duplicated`)
    else evidenceById.set(item.evidence_id, item)
    if (!isText(item.observation_id)) fail(`${label}.observation_id is required`)
    else if (!observationIds.has(item.observation_id)) fail(`${label}.observation_id does not exist`)
    if (!isText(item.record_id)) fail(`${label}.record_id is required`)
    if (!isText(item.film_id)) fail(`${label}.film_id is required`)
    if (!DIMENSIONS.has(item.dimension)) fail(`${label}.dimension is invalid`)
    if (!isText(item.original_quote)) fail(`${label}.original_quote is required`)
    else if (item.original_quote.trim().length < 6) fail(`${label}.original_quote is too short`)
    else {
      const scopedNote = noteFor(item.record_id)
      if (notesByRecord && scopedNote === null) {
        fail(`${label}.record_id has no note in --records-file`)
      } else if (scopedNote && !scopedNote.includes(normalise(item.original_quote))) {
        fail(`${label}.original_quote is not verbatim in the note for ${item.record_id}`)
      }
    }
    if (!isText(item.interpretation)) fail(`${label}.interpretation is required`)
    if (!POLARITIES.has(item.polarity)) fail(`${label}.polarity is invalid`)
    if (!isNumber01(item.strength)) fail(`${label}.strength must be 0..1`)
    if (!isText(item.source)) fail(`${label}.source is required`)
    if (!isText(item.created_at)) fail(`${label}.created_at is required`)
  }

  for (const observation of observations) {
    if (!isObject(observation)) continue
    for (const id of observation.supporting_evidence_ids ?? []) {
      const item = evidenceById.get(id)
      if (!item) fail(`supporting evidence ${id} is missing from evidence[]`)
      else if (item.polarity !== 'supporting') fail(`supporting evidence ${id} has polarity ${item.polarity}`)
      else if (item.observation_id !== observation.observation_id) {
        fail(`supporting evidence ${id} belongs to ${item.observation_id}`)
      }
    }
    for (const id of observation.contradicting_evidence_ids ?? []) {
      const item = evidenceById.get(id)
      if (!item) fail(`contradicting evidence ${id} is missing from evidence[]`)
      else if (item.polarity !== 'contradicting') {
        fail(`contradicting evidence ${id} has polarity ${item.polarity}`)
      } else if (item.observation_id !== observation.observation_id) {
        fail(`contradicting evidence ${id} belongs to ${item.observation_id}`)
      }
    }
  }

  for (const [index, item] of feedback.entries()) {
    const label = `feedback_applied[${index}]`
    if (!isObject(item)) {
      fail(`${label} must be an object`)
      continue
    }
    if (!isText(item.feedback_id)) fail(`${label}.feedback_id is required`)
    if (!isText(item.observation_id) || !observationIds.has(item.observation_id)) {
      fail(`${label}.observation_id does not exist`)
    }
    if (!DECISIONS.has(item.decision)) fail(`${label}.decision is invalid`)
    if (!isText(item.created_at)) fail(`${label}.created_at is required`)
  }

  const snapshot = doc.snapshot
  if (isObject(snapshot)) {
    if (!isText(snapshot.snapshot_id)) fail('snapshot.snapshot_id is required')
    if (!isText(snapshot.created_at)) fail('snapshot.created_at is required')
    if (!isText(snapshot.run_id)) fail('snapshot.run_id is required')
    if (!Array.isArray(snapshot.observations)) fail('snapshot.observations must be an array')
    if (!Array.isArray(snapshot.dimensions)) fail('snapshot.dimensions must be an array')
    if (!isNumber01(snapshot.overall_confidence)) fail('snapshot.overall_confidence must be 0..1')
    if (!Array.isArray(snapshot.changes)) fail('snapshot.changes must be an array')
    if (!Array.isArray(snapshot.corrections_applied)) {
      fail('snapshot.corrections_applied must be an array')
    }
    const snapshotObservationIds = new Set(
      (snapshot.observations ?? [])
        .filter((item) => isObject(item) && isText(item.observation_id))
        .map((item) => item.observation_id),
    )
    for (const id of observationIds) {
      if (!snapshotObservationIds.has(id)) fail(`snapshot is missing observation ${id}`)
    }
    for (const [index, change] of (snapshot.changes ?? []).entries()) {
      const label = `snapshot.changes[${index}]`
      if (!isObject(change)) {
        fail(`${label} must be an object`)
        continue
      }
      if (!isText(change.observation_id)) fail(`${label}.observation_id is required`)
      if (!CHANGE_KINDS.has(change.kind)) fail(`${label}.kind is invalid`)
      if (!isText(change.reason)) fail(`${label}.reason is required`)
    }
  }
}

const report = {
  ok: failures.length === 0,
  input: path.resolve(String(args.input)),
  checked: {
    observations: Array.isArray(doc?.observations) ? doc.observations.length : 0,
    evidence: Array.isArray(doc?.evidence) ? doc.evidence.length : 0,
    feedback_applied: Array.isArray(doc?.feedback_applied) ? doc.feedback_applied.length : 0,
    snapshot_changes: Array.isArray(doc?.snapshot?.changes) ? doc.snapshot.changes.length : 0,
    note_checked: Boolean(note || notesByRecord),
    records_checked: notesByRecord ? notesByRecord.size : 0,
  },
  failures,
}

if (typeof args.out === 'string') {
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
