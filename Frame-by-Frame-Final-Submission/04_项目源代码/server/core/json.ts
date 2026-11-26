export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

/**
 * Models occasionally wrap JSON in prose or a code fence even when asked not
 * to. We recover the first complete object; anything else is a hard failure.
 */
export const extractJson = (text: string): JsonParseResult => {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'empty completion' }
  }
  let candidate = text.trim().replace(/^\uFEFF/, '')
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidate = fence[1].trim()

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: 'no JSON object found in completion' }
  }
  const sliced = candidate.slice(start, end + 1)
  try {
    return { ok: true, value: JSON.parse(sliced) }
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${(error as Error).message.slice(0, 160)}` }
  }
}
