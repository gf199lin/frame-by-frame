import { MOODS } from '@/data/taxonomy'
import type { MoodId, WatchRecord } from '@/types'

export const FELT_LIKE_MAX_TAGS = 6
export const FELT_LIKE_MAX_LENGTH = 12

/** Preset ids stay as ids; user-written feelings stay as their own text. */
export const normaliseFeltLikeTag = (input: string): string => {
  const text = input.trim().replace(/\s+/g, ' ').slice(0, FELT_LIKE_MAX_LENGTH)
  if (!text) return ''
  const byId = (Object.keys(MOODS) as MoodId[]).find((id) => id.toLowerCase() === text.toLowerCase())
  if (byId) return byId
  const byLabel = (Object.keys(MOODS) as MoodId[]).find(
    (id) =>
      MOODS[id].zh === text || MOODS[id].label.toLowerCase() === text.toLowerCase(),
  )
  return byLabel ?? text
}

export const feltLikeLabel = (tag: string): string =>
  MOODS[tag as MoodId]?.zh ?? tag

export const feltLikeText = (tags: string[]): string =>
  tags.map(feltLikeLabel).join('、')

export const feltLikeMoodIds = (tags: string[]): MoodId[] =>
  Array.from(new Set(tags.filter((tag): tag is MoodId => tag in MOODS)))

/** Works for new records and for v1 records that only stored one `feltLike`. */
export const feltLikeTagsOf = (
  record: Pick<WatchRecord, 'feltLike' | 'feltLikeTags'>,
): string[] => {
  const stored = Array.isArray(record.feltLikeTags) ? record.feltLikeTags : []
  const tags = stored.length ? stored : record.feltLike ? [record.feltLike] : []
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
}
