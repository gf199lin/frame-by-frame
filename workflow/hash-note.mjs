#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const i = args.indexOf('--input')
const inputPath = i >= 0 ? args[i + 1] : undefined
if (!inputPath) {
  console.error('Usage: node workflow/hash-note.mjs --input <input.json>')
  process.exit(2)
}

const input = JSON.parse(readFileSync(resolve(process.cwd(), inputPath), 'utf8'))
const note = String(input.note ?? '')
const sha256 = createHash('sha256').update(note, 'utf8').digest('hex')

console.log(JSON.stringify({ input: inputPath, run_id: input.run_id, note_chars: note.length, note_sha256: sha256 }, null, 2))
