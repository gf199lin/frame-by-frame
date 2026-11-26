import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const parseEnvFile = (content: string, target: Record<string, string | undefined>) => {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (target[key] === undefined) target[key] = value
  }
}

/**
 * Reads .env / .env.local / .dev.vars for the local Node runtime only.
 * Values are never returned to the browser.
 */
export const loadEnvFiles = (): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = { ...process.env }
  for (const file of ['.env', '.env.local', '.dev.vars']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    parseEnvFile(readFileSync(path, 'utf8'), env)
  }
  return env
}
