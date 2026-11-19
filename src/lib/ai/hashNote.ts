/**
 * SHA-256 of a note, used as the idempotency anchor.
 * Web Crypto is available in browsers and in Node 18+.
 */
export const sha256Hex = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** A stable idempotency key: one record + one exact note body = one run. */
export const idempotencyKeyFor = (recordId: string, noteSha256: string): string =>
  `${recordId}:${noteSha256}`
