#!/usr/bin/env node
/**
 * Migrate P0 agent artefacts to agent-run.v2 without touching the originals.
 *
 * Usage:
 *   node scripts/migrate-p0-to-v2.mjs
 *   node scripts/migrate-p0-to-v2.mjs --map outputs/p2/migration/record-map.json
 *   node scripts/migrate-p0-to-v2.mjs --derive-ids
 *
 * Association rules, in order:
 *   1. the artefact already has record_id            → association: "existing"
 *   2. --map matches note_sha256 or film|title|year  → association: "mapped"
 *   3. --derive-ids is set                           → association: "derived"
 *   4. otherwise                                     → unresolved, not guessed
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(name)
const valueOf = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const ROOT = process.cwd()
const P0_DIR = join(ROOT, 'outputs', 'p0', 'runs')
const OUT_DIR = resolve(ROOT, valueOf('--out') ?? 'outputs/p2/migration/p0')
const MAP_PATH = valueOf('--map')
const FILM_MAP_PATH = valueOf('--film-map')
const DERIVE = hasFlag('--derive-ids')

/**
 * Only films that can be verified against src/data/films.ts are listed here.
 * Anything else stays null and is reported, never guessed.
 */
const DEFAULT_FILM_MAP = {
  'Manchester by the Sea|2016': 'manchester',
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const short = (hash) => hash.slice(0, 12)

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))

const isRunLike = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.run_id === 'string' &&
  Array.isArray(value.preference_evidence)

const loadMap = () => {
  if (!MAP_PATH) return {}
  const path = resolve(ROOT, MAP_PATH)
  if (!existsSync(path)) {
    console.error(`map file not found: ${path}`)
    process.exit(2)
  }
  return readJson(path)
}

const loadFilmMap = () => {
  const extra = {}
  if (FILM_MAP_PATH) {
    const path = resolve(ROOT, FILM_MAP_PATH)
    if (!existsSync(path)) {
      console.error(`film map not found: ${path}`)
      process.exit(2)
    }
    Object.assign(extra, readJson(path))
  }
  return { ...DEFAULT_FILM_MAP, ...extra }
}

const mapKey = (film, noteSha) =>
  `${film?.title ?? ''}|${film?.year ?? ''}|${noteSha}`

const resolveRecordId = (raw, map) => {
  if (typeof raw.record_id === 'string' && raw.record_id) {
    return { recordId: raw.record_id, association: 'existing' }
  }
  const noteSha = raw.note_sha256 ?? raw.input?.note_sha256 ?? ''
  const film = raw.input?.film ?? raw.film ?? {}
  const byNote = noteSha ? map[noteSha] : undefined
  if (typeof byNote === 'string' && byNote) return { recordId: byNote, association: 'mapped' }
  const byFilm = map[mapKey(film, noteSha)]
  if (typeof byFilm === 'string' && byFilm) return { recordId: byFilm, association: 'mapped' }
  if (DERIVE) {
    const seed = `${film.title ?? ''}|${film.year ?? ''}|${noteSha}`
    return { recordId: `rec_p0_${short(sha256(seed))}`, association: 'derived' }
  }
  return { recordId: '', association: 'unresolved' }
}

const validateRun = (run) => {
  const errors = []
  if (run.schema_version !== 2) errors.push('schema_version must be 2')
  for (const key of ['request_id', 'record_id', 'run_id', 'agent_id']) {
    if (typeof run[key] !== 'string' || !run[key]) errors.push(`${key} is required`)
  }
  if (!Array.isArray(run.preference_evidence)) errors.push('preference_evidence must be array')
  if (!run.analysis || typeof run.analysis !== 'object') errors.push('analysis must be object')
  return errors
}

const toRunV2 = (raw, file, recordId, association, noteSha, filmId) => {
  const runId = `run_p0_${short(sha256(`${noteSha}:${raw.run_id ?? file}`))}`
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : null
  return {
    schema_version: 2,
    request_id: typeof raw.request_id === 'string' ? raw.request_id : `req_p0_${short(runId)}`,
    record_id: recordId,
    run_id: runId,
    status: 'succeeded',
    // P0 ran in the local Agent workspace. It is not a DeepWorks cloud run.
    provider: 'local-engine',
    agent_id: typeof raw.agent_id === 'string' ? raw.agent_id : 'film-curator',
    agent_version: typeof raw.agent_version === 'string' ? raw.agent_version : 'unknown',
    workflow_version: typeof raw.workflow_version === 'string' ? raw.workflow_version : 'unknown',
    skills_used: Array.isArray(raw.skills_used) ? raw.skills_used : [],
    kb_citations: Array.isArray(raw.kb_citations) ? raw.kb_citations : [],
    analysis: {
      ...raw.analysis,
      uncertainties: raw.analysis?.uncertainties ?? raw.uncertainties ?? [],
    },
    preference_evidence: Array.isArray(raw.preference_evidence) ? raw.preference_evidence : [],
    profile_delta: raw.profile_delta ?? null,
    profile_version: typeof raw.profile_version === 'string' ? raw.profile_version : null,
    quality_gates:
      raw.quality_gates && typeof raw.quality_gates === 'object' ? raw.quality_gates : {},
    started_at: timestamp,
    completed_at: timestamp,
    error: null,
    film_id: filmId,
    model: typeof raw.model === 'string' ? raw.model : undefined,
    platform: typeof raw.platform === 'string' ? raw.platform : undefined,
    migration: {
      source_file: basename(file),
      source_sha256: sha256(JSON.stringify(raw)),
      association,
      // Deterministic on purpose: re-running must produce byte-identical runs.
      rule: 'p0-to-v2@1',
      film_unresolved: !filmId,
    },
  }
}

const main = () => {
  if (!existsSync(P0_DIR)) {
    console.error(`no P0 directory: ${P0_DIR}`)
    process.exit(2)
  }
  const files = readdirSync(P0_DIR).filter((name) => name.endsWith('.json')).sort()
  if (!files.length) {
    console.error('no P0 artefacts found')
    process.exit(2)
  }

  const map = loadMap()
  const filmMap = loadFilmMap()
  const resolved = []
  const unresolved = []
  const seen = new Set()
  const report = { generated_at: new Date().toISOString(), files: [], counts: {} }

  for (const name of files) {
    const path = join(P0_DIR, name)
    const rawText = readFileSync(path, 'utf8')
    const before = sha256(rawText)
    let raw
    try {
      raw = readJson(path)
    } catch (error) {
      report.files.push({ file: name, sha256_before: before, status: 'skipped', reason: 'not JSON' })
      continue
    }

    // The P0 folder also holds gate/validation reports. Only runs are migrated.
    if (!isRunLike(raw)) {
      report.files.push({ file: name, sha256_before: before, status: 'skipped', reason: 'not a run artefact' })
      continue
    }

    const noteSha = raw.note_sha256 ?? raw.input?.note_sha256 ?? ''
    const film = raw.input?.film ?? raw.film ?? {}
    const filmId =
      typeof film.id === 'string' && film.id
        ? film.id
        : filmMap[`${film.title ?? ''}|${film.year ?? ''}`] ?? null
    const { recordId, association } = resolveRecordId(raw, map)

    if (!recordId) {
      unresolved.push({
        file: name,
        reason: 'no record_id and no mapping; refusing to guess',
        note_sha256: noteSha,
        film: raw.input?.film ?? raw.film ?? null,
      })
      report.files.push({ file: name, sha256_before: before, status: 'unresolved' })
      continue
    }

    const run = toRunV2(raw, path, recordId, association, noteSha, filmId)
    const errors = validateRun(run)
    if (errors.length) {
      unresolved.push({ file: name, reason: `invalid v2: ${errors.join('; ')}` })
      report.files.push({ file: name, sha256_before: before, status: 'invalid-v2', errors })
      continue
    }

    // Repeated runs must not duplicate a run.
    if (seen.has(run.run_id)) {
      report.files.push({ file: name, sha256_before: before, status: 'duplicate', run_id: run.run_id })
      continue
    }
    seen.add(run.run_id)
    resolved.push(run)
    report.files.push({
      file: name,
      sha256_before: before,
      sha256_after_source: sha256(readFileSync(path, 'utf8')),
      status: 'resolved',
      association,
      run_id: run.run_id,
      record_id: recordId,
    })
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const writeStable = (name, value) => {
    const text = `${JSON.stringify(value, null, 2)}\n`
    writeFileSync(join(OUT_DIR, name), text, 'utf8')
    return sha256(text)
  }

  report.counts = {
    total: files.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    derived: resolved.filter((run) => run.migration.association === 'derived').length,
    film_unresolved: resolved.filter((run) => run.migration.film_unresolved).length,
  }
  report.outputs = {
    resolved: writeStable('p0-v2-resolved.json', resolved),
    unresolved: writeStable('p0-unresolved.json', unresolved),
  }
  writeStable('migration-report.json', report)

  console.log(JSON.stringify(report.counts, null, 2))
  if (unresolved.length) {
    console.log(`unresolved entries: ${unresolved.length} (see ${join(OUT_DIR, 'p0-unresolved.json')})`)
  }
}

main()
