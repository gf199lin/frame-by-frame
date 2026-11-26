#!/usr/bin/env node
/**
 * Verifies that a directory contains a REAL DeepWorks platform run for the
 * Taste Evolution mode. It exists to stop local/simulated output from being
 * reported as a platform run.
 *
 * Required files in --dir:
 *   run-record.json   { run_id, platform, agent, model, session_id, started_at, skills[] }
 *   evolution.json    taste-evolution.v1 output (run_id must match run-record)
 *   screenshot.png    platform UI screenshot, > 20 KB
 *   kb.json           { kb_provider: 'platform', tool: 'sass_search', status, queries[] }
 *                     or { unavailable_reason: '...' }
 * Optional:
 *   records.json      [{ record_id, note }] for cross-record quote validation
 *   note.txt          single-note fallback
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = {}
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i]
  if (!key.startsWith('--')) continue
  const value = process.argv[i + 1]
  args[key.slice(2)] = value && !value.startsWith('--') ? (i += 1, value) : true
}

const dir = typeof args.dir === 'string' ? path.resolve(args.dir) : null
if (!dir) {
  console.error('usage: node workflow/verify-platform-run.mjs --dir <run-dir> [--out verification.json]')
  process.exit(2)
}

const failures = []
const checks = []
const readJson = (name) => {
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) {
    failures.push(`missing ${name}`)
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    failures.push(`${name} is not valid JSON: ${error.message}`)
    return null
  }
}

const run = readJson('run-record.json')
const evolution = readJson('evolution.json')
const kb = readJson('kb.json')

for (const name of ['run_id', 'platform', 'agent', 'model', 'session_id', 'started_at']) {
  if (run && (typeof run[name] !== 'string' || run[name].trim() === '')) {
    failures.push(`run-record.json.${name} is missing`)
  }
}
if (run?.platform && run.platform !== 'DeepWorks') {
  failures.push(`run-record.json.platform must be DeepWorks, got ${run.platform}`)
}
if (run?.skills && (!Array.isArray(run.skills) || run.skills.length === 0)) {
  failures.push('run-record.json.skills must list the skills actually invoked')
}
checks.push('run record fields')

if (run?.run_id && typeof run.run_id === 'string' && /^(local|seed|dw-ses_|dw-msg_)/i.test(run.run_id)) {
  failures.push(`run_id looks derived/local, not a platform run id: ${run.run_id}`)
}
if (run && evolution && evolution.run_id !== run.run_id) {
  failures.push(`evolution.run_id (${evolution.run_id}) != run-record.run_id (${run.run_id})`)
}
checks.push('run id linkage')

if (evolution?.provenance?.run_id_kind === 'derived-from-session-and-message-id') {
  failures.push('evolution.provenance says the run id is derived from a session id; that is not a platform run record')
}

if (kb) {
  if (typeof kb.unavailable_reason === 'string' && kb.unavailable_reason.trim() !== '') {
    checks.push('platform KB explicitly marked unavailable')
  } else if (kb.kb_provider === 'platform' && kb.tool === 'sass_search' && kb.status === 'ok') {
    if (!Array.isArray(kb.queries) || kb.queries.length === 0) {
      failures.push('kb.json claims platform retrieval but has no queries[]')
    }
    checks.push('platform KB sass_search evidence')
  } else {
    failures.push('kb.json must either prove sass_search (kb_provider=platform, tool=sass_search, status=ok) or state unavailable_reason')
  }
} else {
  failures.push('kb.json missing: record platform retrieval or the explicit unavailability reason')
}

const screenshot = fs
  .readdirSync(dir)
  .find((name) => /\.(png|jpe?g)$/i.test(name) && fs.statSync(path.join(dir, name)).size > 20 * 1024)
if (!screenshot) failures.push('no platform screenshot larger than 20 KB (.png/.jpg)')
else checks.push(`screenshot ${screenshot}`)

const recordsFile = path.join(dir, 'records.json')
const noteFile = path.join(dir, 'note.txt')
const evolutionFile = path.join(dir, 'evolution.json')
if (fs.existsSync(evolutionFile)) {
  const validator = path.join(process.cwd(), 'workflow', 'validate-taste-evolution.mjs')
  const validatorArgs = [validator, '--input', evolutionFile]
  if (fs.existsSync(recordsFile)) validatorArgs.push('--records-file', recordsFile)
  else if (fs.existsSync(noteFile)) validatorArgs.push('--note-file', noteFile)
  else failures.push('need records.json or note.txt to verify quotes')
  if (fs.existsSync(recordsFile) || fs.existsSync(noteFile)) {
    const result = spawnSync(process.execPath, validatorArgs, { encoding: 'utf8' })
    let parsed = null
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      /* validator may print nothing on hard failure */
    }
    if (result.status !== 0 || parsed?.ok !== true) {
      failures.push(`evolution.json failed validate-taste-evolution.mjs: ${(result.stdout || result.stderr || '').slice(0, 400)}`)
    } else {
      checks.push('evolution.json passes contract validator')
    }
  }
}

const output = {
  ok: failures.length === 0,
  dir,
  checked_at: new Date().toISOString(),
  checks,
  failures,
  note: 'ok=true only means the platform artifacts and contract checks are present. It does not replace human review of the screenshot content.',
}
const text = `${JSON.stringify(output, null, 2)}\n`
if (typeof args.out === 'string') fs.writeFileSync(path.resolve(args.out), text, 'utf8')
console.log(text)
process.exit(output.ok ? 0 : 1)
