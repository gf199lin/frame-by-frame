#!/usr/bin/env node
/**
 * Final quality gate for a P0 Film Curator run.
 * Verifies provenance, skill usage, KB citations, verbatim evidence, profile shape,
 * note integrity and quality gates.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { PROFILE_THRESHOLDS } from '../.opencode/skills/cinema-taste-profiling/scripts/profile-thresholds.mjs'

const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const runPath = option('--run')
const inputPath = option('--input')
if (!runPath || !inputPath) {
  console.error('Usage: node workflow/validate-run.mjs --run <final.json> --input <input.json>')
  process.exit(2)
}

const run = JSON.parse(readFileSync(resolve(process.cwd(), runPath), 'utf8'))
const input = JSON.parse(readFileSync(resolve(process.cwd(), inputPath), 'utf8'))
const kb = JSON.parse(readFileSync(resolve(process.cwd(), 'knowledge', 'entries.json'), 'utf8'))
const kbMap = new Map((kb.entries ?? []).map((entry) => [entry.id, entry]))

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

const DIMENSIONS = new Set(['narrative', 'emotion', 'thematic', 'visual', 'character', 'ending'])
const ALL_DIMENSIONS = ['narrative', 'emotion', 'thematic', 'visual', 'character', 'ending']
const MOODS = new Set([
  'melancholy', 'tender', 'wistful', 'hopeful', 'restrained', 'cathartic',
  'uneasy', 'awe', 'warmth', 'longing', 'playful', 'quiet',
])
const THEMES = new Set([
  'memory', 'loss', 'grief', 'identity', 'love', 'ambition', 'freedom',
  'family', 'hope', 'loneliness', 'art', 'time', 'reality', 'friendship',
  'coming-of-age', 'forgiveness', 'sacrifice', 'justice',
])
// AI Core v1.0.0: four-value direction. `neutral` means "the note explicitly
// shows no clear pull on this axis"; it is NOT the default for unobserved axes.
// An unobserved axis must be omitted (or left unobserved in the profile).
const DIRECTIONS = new Set(['high', 'low', 'neutral', 'ambivalent'])
const EVIDENCE_TYPES = new Set(['user_quote', 'inference'])

const requiredTop = [
  'agent', 'agent_id', 'platform', 'model', 'run_id', 'timestamp',
  'skills_used', 'kb_status', 'retrieval_log', 'kb_citations',
  'analysis', 'preference_evidence', 'profile_delta', 'uncertainties',
  'input', 'quality_gates',
]
for (const key of requiredTop) {
  if (run[key] === undefined) fail(`missing top-level field: ${key}`)
}

if (run.platform !== 'DeepWorks') fail('platform must be "DeepWorks"')
if (!String(run.model ?? '').startsWith('dth/')) fail('model must be a DeepWorks dth/* model')
if (run.agent_id !== 'film-curator') fail('agent_id must be "film-curator"')
if (run.run_id !== input.run_id) fail(`run_id mismatch: run="${run.run_id}" input="${input.run_id}"`)
if (!run.timestamp || Number.isNaN(Date.parse(run.timestamp))) fail('timestamp must be an ISO 8601 string')

// Version identifiers are optional for backward compatibility with runs created
// before AI Core v1.0.0. When present they must be non-empty strings; their
// value semantics are defined in AI_CHANGELOG.md.
for (const key of ['core_spec_version', 'agent_version', 'workflow_version', 'profile_algorithm_version']) {
  if (run[key] !== undefined && !String(run[key]).trim()) fail(`${key} must be a non-empty string when present`)
}

const note = String(input.note ?? '')
const sha256 = createHash('sha256').update(note, 'utf8').digest('hex')
if (run.input?.note_sha256 !== sha256) fail('input.note_sha256 does not match the input note')
if (run.input?.note_chars !== note.length) fail('input.note_chars does not match the input note length')
if (run.input?.note_unchanged !== true) fail('input.note_unchanged must be true')
if (run.input?.film?.title !== input.film?.title) fail('input.film.title does not match the input')
if (run.input?.film?.year !== input.film?.year) fail('input.film.year does not match the input')

const requiredSkills = ['cinema-knowledge-retrieval', 'film-note-analysis', 'cinema-taste-profiling']
const skills = Array.isArray(run.skills_used) ? run.skills_used : []
for (const name of requiredSkills) {
  const item = skills.find((entry) => entry?.name === name)
  if (!item) fail(`skills_used is missing: ${name}`)
  else {
    if (item.invoked !== true) fail(`${name}.invoked must be true`)
    if (!['skill', 'read'].includes(item.via)) fail(`${name}.via must be "skill" or "read"`)
  }
}

// kb_status is a three-state terminal condition, not a boolean.
//   cited            - the run must carry real, verbatim-verified citations
//   no_relevant_entry- the platform returned entries, none of them explained the note
//   unavailable      - the platform tool was not reachable; this is NOT "no relevant entry"
const KB_STATES = new Set(['cited', 'no_relevant_entry', 'unavailable'])
const kbStatus = String(run.kb_status ?? '')
const retrievalLog = run.retrieval_log ?? {}
if (!KB_STATES.has(kbStatus)) {
  fail(`kb_status is invalid: "${kbStatus}" (expected cited | no_relevant_entry | unavailable)`)
}

const citations = Array.isArray(run.kb_citations) ? run.kb_citations : []

if (kbStatus === 'cited') {
  if (citations.length === 0) fail('kb_status "cited" requires at least one real citation')
  if (retrievalLog.fallback_used === true && retrievalLog.kb_provider === 'platform') {
    fail('kb_provider cannot be "platform" when fallback_used is true (silent fallback)')
  }
} else if (kbStatus === 'no_relevant_entry') {
  if (citations.length !== 0) fail('kb_status "no_relevant_entry" requires zero citations')
  if (retrievalLog.fallback_used === true) {
    fail('kb_status "no_relevant_entry" must not be produced by a local fallback')
  }
  if (retrievalLog.kb_provider !== 'platform') {
    fail('kb_status "no_relevant_entry" requires real platform retrieval (retrieval_log.kb_provider = "platform")')
  }
  if (!String(retrievalLog.platform_tool ?? '').trim()) {
    fail('kb_status "no_relevant_entry" requires retrieval_log.platform_tool')
  }
  const reasons = Array.isArray(retrievalLog.relevance_reasons) ? retrievalLog.relevance_reasons : []
  if (reasons.length === 0) {
    fail('kb_status "no_relevant_entry" requires retrieval_log.relevance_reasons explaining why nothing matched')
  }
} else if (kbStatus === 'unavailable') {
  if (citations.length !== 0) fail('kb_status "unavailable" requires zero citations')
  if (!String(retrievalLog.unavailable_evidence ?? '').trim()) {
    fail('kb_status "unavailable" requires retrieval_log.unavailable_evidence (real failure evidence)')
  }
  if (retrievalLog.fallback_used === true && retrievalLog.fallback_authorized !== true) {
    fail('local fallback under "unavailable" is only allowed when retrieval_log.fallback_authorized is true')
  }
}

if (citations.length > 3) warn(`kb_citations has ${citations.length} items; prefer 0-3`)
const seenKb = new Set()
citations.forEach((citation, index) => {
  const where = `kb_citations[${index}]`
  const id = String(citation?.kb_id ?? '')
  const entry = kbMap.get(id)
  if (!entry) {
    fail(`${where}.kb_id does not exist: "${id}"`)
    return
  }
  if (seenKb.has(id)) fail(`${where}.kb_id is duplicated: "${id}"`)
  seenKb.add(id)
  if (String(citation.title ?? '') !== entry.title) fail(`${where}.title does not match ${id}`)
  if (String(citation.source ?? '') !== entry.source) fail(`${where}.source does not match ${id}`)
  const excerpt = String(citation.excerpt ?? '')
  if (!excerpt.trim()) fail(`${where}.excerpt is empty`)
  else if (!normalize(entry.text).includes(normalize(excerpt))) fail(`${where}.excerpt is NOT a verbatim substring of ${id}`)
  if (!String(citation.why_relevant ?? '').trim()) fail(`${where}.why_relevant is empty`)
})

const analysis = run.analysis ?? {}
if (!String(analysis.summary ?? '').trim()) fail('analysis.summary is empty')
if (!Array.isArray(analysis.observed_emotions) || analysis.observed_emotions.length === 0) {
  fail('analysis.observed_emotions must be a non-empty array')
} else {
  analysis.observed_emotions.forEach((item, index) => {
    if (!MOODS.has(String(item?.mood ?? ''))) fail(`analysis.observed_emotions[${index}].mood is invalid`)
    if (!String(item?.evidence ?? '').trim()) fail(`analysis.observed_emotions[${index}].evidence is empty`)
  })
}
if (!Array.isArray(analysis.themes_identified) || analysis.themes_identified.length === 0) {
  fail('analysis.themes_identified must be a non-empty array')
} else {
  analysis.themes_identified.forEach((item, index) => {
    if (!THEMES.has(String(item?.theme ?? ''))) fail(`analysis.themes_identified[${index}].theme is invalid`)
    if (!String(item?.evidence ?? '').trim()) fail(`analysis.themes_identified[${index}].evidence is empty`)
  })
}
if (!Number.isFinite(analysis.confidence) || analysis.confidence < 0 || analysis.confidence > 1) {
  fail('analysis.confidence must be a number in [0,1]')
}

const evidence = Array.isArray(run.preference_evidence) ? run.preference_evidence : []
if (evidence.length < 3 || evidence.length > 8) fail('preference_evidence must contain 3-8 items')
const seenQuotes = new Set()
const dimensionsUsed = new Set()
evidence.forEach((item, index) => {
  const where = `preference_evidence[${index}]`
  const dimension = String(item?.dimension_id ?? '')
  const direction = String(item?.direction ?? '')
  const type = String(item?.evidence_type ?? '')
  const quote = String(item?.quote ?? '')
  if (!DIMENSIONS.has(dimension)) fail(`${where}.dimension_id is invalid`)
  else dimensionsUsed.add(dimension)
  if (!DIRECTIONS.has(direction)) fail(`${where}.direction is invalid`)
  if (!EVIDENCE_TYPES.has(type)) fail(`${where}.evidence_type is invalid`)
  if (!Number.isFinite(item?.strength) || item.strength < 0 || item.strength > 1) fail(`${where}.strength must be in [0,1]`)
  if (!Number.isFinite(item?.confidence) || item.confidence < 0 || item.confidence > 1) fail(`${where}.confidence must be in [0,1]`)
  if (!String(item?.interpretation ?? '').trim()) fail(`${where}.interpretation is empty`)
  // AI Core v1.0.0 source identifiers. Optional here so runs produced before the
  // standard keep validating; an adapter that claims the new evidence shape must
  // fill them (see AI_ADAPTERS.md).
  for (const key of ['source_film_id', 'source_note_id']) {
    if (item?.[key] !== undefined && !String(item[key]).trim()) fail(`${where}.${key} must be a non-empty string when present`)
  }
  if (!quote.trim()) fail(`${where}.quote is empty`)
  else {
    const normalized = normalize(quote)
    if (!note.includes(quote) && !normalize(note).includes(normalized)) {
      fail(`${where}.quote is NOT found in the input note: "${quote}"`)
    }
    if (seenQuotes.has(normalized)) fail(`${where}.quote is duplicated`)
    seenQuotes.add(normalized)
  }
})
if (dimensionsUsed.size < 3) fail(`only ${dimensionsUsed.size} distinct dimensions covered; need at least 3`)

const profile = run.profile_delta ?? {}
const isProfileV2 = run.schema_version === 2 || profile.schema_version === 2
if (isProfileV2) {
  if (profile.evidence_count !== evidence.length) {
    fail('profile_delta.evidence_count must equal preference_evidence length')
  }
  if (profile.sample_size !== profile.evidence_count) {
    fail('profile_delta.sample_size must stay an alias of evidence_count in schema v2')
  }
  if (!Number.isInteger(profile.independent_note_count) || profile.independent_note_count < 1) {
    fail('profile_delta.independent_note_count must be a positive integer')
  }
  if (!Number.isInteger(profile.sufficient_dimensions) || profile.sufficient_dimensions < 0) {
    fail('profile_delta.sufficient_dimensions must be a non-negative integer in schema v2')
  }
  if (!Number.isInteger(profile.duplicate_evidence_count) || profile.duplicate_evidence_count < 0) {
    fail('profile_delta.duplicate_evidence_count must be a non-negative integer')
  }
  if (!Number.isInteger(profile.duplicate_note_count) || profile.duplicate_note_count < 0) {
    fail('profile_delta.duplicate_note_count must be a non-negative integer')
  }
  if (typeof profile.sufficient !== 'boolean') fail('profile_delta.sufficient must be a boolean')
  if (typeof profile.provisional !== 'boolean') fail('profile_delta.provisional must be a boolean')
  if (profile.sufficient === false && profile.provisional !== true) {
    fail('profile_delta.provisional must be true when sufficient is false')
  }
  for (const key of ALL_DIMENSIONS) {
    const dim = profile.dimensions?.[key]
    if (!dim) {
      fail(`profile_delta.dimensions is missing: ${key}`)
      continue
    }
    if (dim.status === 'unobserved') {
      if (dim.score !== null) fail(`profile_delta.dimensions.${key}.score must be null when unobserved`)
      if (dim.lean !== 'unknown') fail(`profile_delta.dimensions.${key}.lean must be "unknown" when unobserved`)
      if (dim.neutral_default !== false) fail(`profile_delta.dimensions.${key}.neutral_default must be false when unobserved`)
      if (dim.sufficient !== false) fail(`profile_delta.dimensions.${key}.sufficient must be false when unobserved`)
      continue
    }
    if (!Number.isFinite(dim.score) || dim.score < 0 || dim.score > 100) fail(`profile_delta.dimensions.${key}.score must be in [0,100]`)
    if (!Number.isFinite(dim.confidence) || dim.confidence < 0 || dim.confidence > 1) fail(`profile_delta.dimensions.${key}.confidence must be in [0,1]`)
    if (!Number.isInteger(dim.note_count) || dim.note_count < 1) fail(`profile_delta.dimensions.${key}.note_count must be a positive integer`)
    if (!Number.isInteger(dim.evidence_count) || dim.evidence_count < 1) fail(`profile_delta.dimensions.${key}.evidence_count must be a positive integer`)
  }
  if (profile.sufficient === true) {
    const observed = ALL_DIMENSIONS.filter((key) => (profile.dimensions?.[key]?.note_count ?? 0) > 0).length
    if (profile.sufficient_dimensions < PROFILE_THRESHOLDS.overallMinSufficientDimensions) {
      fail(`profile_delta.sufficient_dimensions must be >= ${PROFILE_THRESHOLDS.overallMinSufficientDimensions} when sufficient is true`)
    }
    if (profile.independent_note_count < PROFILE_THRESHOLDS.overallMinNotes) {
      fail(`profile_delta.independent_note_count must be >= ${PROFILE_THRESHOLDS.overallMinNotes} when sufficient is true`)
    }
    if (observed < PROFILE_THRESHOLDS.overallMinDimensions) {
      fail(`profile_delta must observe at least ${PROFILE_THRESHOLDS.overallMinDimensions} dimensions when sufficient is true`)
    }
  }
} else {
  if (profile.sample_size !== evidence.length) fail('profile_delta.sample_size must equal preference_evidence length')
  if (typeof profile.insufficient_samples !== 'boolean') fail('profile_delta.insufficient_samples must be a boolean')
  if (evidence.length < 3 && profile.insufficient_samples !== true) fail('profile_delta must flag insufficient_samples when evidence < 3')
  for (const key of ALL_DIMENSIONS) {
    const dim = profile.dimensions?.[key]
    if (!dim) fail(`profile_delta.dimensions is missing: ${key}`)
    else {
      if (!Number.isFinite(dim.score) || dim.score < 0 || dim.score > 100) fail(`profile_delta.dimensions.${key}.score must be in [0,100]`)
      if (!Number.isFinite(dim.confidence) || dim.confidence < 0 || dim.confidence > 1) fail(`profile_delta.dimensions.${key}.confidence must be in [0,1]`)
    }
  }
}

if (!Array.isArray(run.uncertainties) || run.uncertainties.length === 0) {
  fail('uncertainties must contain at least one item')
}

const gates = run.quality_gates ?? {}
for (const key of ['evidence_verbatim', 'kb_citations_valid', 'note_unchanged', 'uncertainties_present']) {
  if (gates[key] !== true) fail(`quality_gates.${key} must be true`)
}

const schemaValid = failures.length === 0
const businessOutcome =
  kbStatus === 'cited'
    ? 'analysis_completed_with_kb_support'
    : kbStatus === 'no_relevant_entry'
      ? 'analysis_completed_without_kb_support'
      : kbStatus === 'unavailable'
        ? 'blocked_kb_unavailable'
        : 'invalid'
const workflowCorrect = schemaValid && (kbStatus === 'cited' || kbStatus === 'no_relevant_entry')

const report = {
  ok: schemaValid,
  schema_valid: schemaValid,
  workflow_correct: workflowCorrect,
  business_outcome: businessOutcome,
  business_outcome_note:
    'Machine checks cover evidence integrity and structure only. A passing schema does not prove the film analysis is good; no_relevant_entry in particular means the analysis ran without KB support.',
  run: runPath,
  input: inputPath,
  run_id: run.run_id,
  kb_status: kbStatus || null,
  checks: {
    platform: run.platform,
    model: run.model,
    skills: skills.map((s) => `${s.name}:${s.invoked ? 'invoked' : 'not-invoked'}:${s.via ?? '?'}`),
    kb_citations: citations.map((c) => c.kb_id),
    evidence_count: evidence.length,
    dimensions: [...dimensionsUsed],
    profile_sample_size: profile.sample_size,
    profile_schema_version: profile.schema_version ?? 1,
    independent_note_count: profile.independent_note_count ?? null,
    sufficient_dimensions: profile.sufficient_dimensions ?? null,
    note_sha256: sha256,
  },
  warnings,
  failures,
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
