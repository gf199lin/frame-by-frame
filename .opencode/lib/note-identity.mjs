/**
 * Stable note identity for Frame by Frame.
 *
 * note_id is derived from movie identity + normalized note text, so the same
 * words in two different films are never merged. Normalization removes
 * punctuation/whitespace only; it does not attempt semantic rewriting.
 */
import { createHash } from 'node:crypto'

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g
const PUNCT = /[，。！？、；：,.!?;:'"“”‘’（）()【】\[\]—–\-…·《》<>~～/\\|]/g

export function normalizeNote(text = '') {
  return String(text)
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, '')
    .replace(PUNCT, '')
    .toLowerCase()
}

const TMDB_KEYS = ['tmdbId', 'tmdb_id']

const present = (value) => value !== undefined && value !== null && String(value).trim() !== ''

/**
 * Namespaced movie identity.
 *
 * Priority: tmdb:<id> -> film:<internal id> -> title:<title>|<year>.
 * TMDB ids and internal ids are separate namespaces even when both are "123";
 * they are never merged without an explicit data contract.
 */
export function movieIdentity(film = {}) {
  const tmdbKey = TMDB_KEYS.find((key) => present(film?.[key]))
  if (tmdbKey) return `tmdb:${String(film[tmdbKey]).trim()}`
  if (present(film?.id)) return `film:${String(film.id).trim().toLowerCase()}`
  const title = String(film?.title ?? '').trim().toLowerCase()
  const year = String(film?.year ?? '').trim()
  if (title || year) return `title:${title}|${year}`
  return 'identity_missing'
}

export function sha256(text = '') {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

/**
 * Identity-missing notes get a namespaced run-local id so that unrelated notes
 * are never merged. They cannot be deduplicated across runs unless the caller
 * supplies a stable recordId/viewingId.
 */
export function computeNoteId(film, note, options = {}) {
  const identity = movieIdentity(film)
  const normalized = normalizeNote(note)
  if (identity === 'identity_missing') {
    const record = options.recordId ?? options.viewingId ?? options.record_id
    const suffix = present(record)
      ? `record:${String(record).trim()}`
      : Number.isInteger(options.inputIndex)
        ? `input:${options.inputIndex}`
        : 'unstable'
    return `sha256:${sha256(`identity_missing|${suffix}|${normalized}`)}`
  }
  return `sha256:${sha256(`${identity}|${normalized}`)}`
}

/**
 * Detect duplicate submissions among records.
 * Each record: { note_id, viewing_id?, note_sha256? }
 * Same note_id -> duplicate_of points at the first viewing_id/note_id.
 */
export function detectDuplicateNotes(records = []) {
  const firstSeen = new Map()
  const duplicates = []
  for (const r of records) {
    const id = r.note_id
    if (!id) continue
    if (firstSeen.has(id)) {
      duplicates.push({
        note_id: id,
        duplicate_of: firstSeen.get(id),
        viewing_id: r.viewing_id ?? null,
        note_sha256: r.note_sha256 ?? null,
      })
    } else {
      firstSeen.set(id, r.viewing_id ?? id)
    }
  }
  return {
    independent_note_ids: [...firstSeen.keys()],
    duplicate_notes: duplicates,
    duplicate_note_count: duplicates.length,
  }
}
