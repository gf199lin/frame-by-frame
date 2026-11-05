export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')

export const pad = (n: number): string => String(n).padStart(2, '0')

export const formatRating = (rating: number): string =>
  Number.isInteger(rating) ? rating.toFixed(1) : rating.toFixed(1)

export const formatLongDate = (iso: string): string => {
  const d = parseDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export const formatShortDate = (iso: string): string => {
  const d = parseDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatMonthYear = (iso: string): string => {
  const d = parseDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export const parseDate = (iso: string): Date | null => {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const daysAgo = (iso: string, now = new Date()): number => {
  const d = parseDate(iso)
  if (!d) return 0
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 86_400_000))
}

export const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${pad(m)}m`
}

export const percent = (value: number): string => `${Math.round(value * 100)}%`

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value))

export const plural = (count: number, one: string, many?: string): string =>
  count === 1 ? one : many ?? `${one}s`

export const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const monthKey = (iso: string): string => iso.slice(0, 7)

export const sentenceCase = (text: string): string =>
  text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)

export const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

export const truncate = (text: string, length: number): string =>
  text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`

export const uid = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
