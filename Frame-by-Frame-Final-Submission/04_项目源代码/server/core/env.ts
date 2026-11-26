export type Env = Record<string, string | undefined>

export type ProviderName = 'deepseek' | 'stub'

export type AIConfig = {
  provider: ProviderName
  apiKey: string
  baseUrl: string
  model: string
  allowedOrigins: string[]
  debug: boolean
  /** Hard cap for one upstream call, in milliseconds. */
  timeoutMs: number
}

export type ConfigResult =
  | { configured: true; config: AIConfig }
  | { configured: false; reason: 'missing_key' | 'stub_not_allowed' }

export const readConfig = (env: Env): ConfigResult => {
  const provider = (env.AI_PROVIDER ?? 'deepseek').toLowerCase() as ProviderName

  if (provider === 'stub') {
    if (env.ALLOW_STUB_PROVIDER !== '1') {
      return { configured: false, reason: 'stub_not_allowed' }
    }
    return {
      configured: true,
      config: {
        provider: 'stub',
        apiKey: '',
        baseUrl: '',
        model: 'stub-local-verification',
        allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
        debug: env.AI_DEBUG === '1',
        timeoutMs: Number(env.AI_TIMEOUT_MS ?? 45_000),
      },
    }
  }

  const apiKey = (env.DEEPSEEK_API_KEY ?? '').trim()
  if (!apiKey) return { configured: false, reason: 'missing_key' }

  return {
    configured: true,
    config: {
      provider: 'deepseek',
      apiKey,
      baseUrl: (env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, ''),
      model: env.AI_MODEL ?? 'deepseek-chat',
      allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
      debug: env.AI_DEBUG === '1',
      timeoutMs: clampTimeout(env.AI_TIMEOUT_MS),
    },
  }
}

const clampTimeout = (raw: string | undefined): number => {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 45_000
  return Math.min(90_000, Math.max(5_000, value))
}

const parseOrigins = (raw: string | undefined): string[] => {
  if (!raw || !raw.trim()) return ['*']
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}
