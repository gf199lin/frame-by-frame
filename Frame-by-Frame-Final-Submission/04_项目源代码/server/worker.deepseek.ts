/**
 * Cloudflare Worker entry point for the DeepSeek-only API.
 *
 * The Node entry (`server/node.ts`) also exposes the DeepWorks agent bridge,
 * which needs `node:child_process` and therefore cannot run in Workers. This
 * entry reuses the same validation, prompt and provider code but registers only
 * `GET /health` and `POST /v1/analyze`.
 */
import { LIMITS, PROMPT_VERSION } from './core/contract.ts'
import { readConfig, type Env } from './core/env.ts'
import { RateLimiter } from './core/rateLimit.ts'
import { AIError, analyzeFilm } from './core/service.ts'
import { createProvider } from './core/provider.ts'
import { validateAnalyzeRequest } from './core/validate.ts'
import type { AIErrorCode } from './core/types.ts'

type WorkerEnv = Record<string, string | undefined>

const STATUS: Record<AIErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  AI_NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  INVALID_MODEL_OUTPUT: 422,
  INTERNAL: 500,
}

const limiter = new RateLimiter()

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

const allowedOriginList = (env: WorkerEnv): string[] =>
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

const corsHeaders = (request: Request, env: WorkerEnv): Record<string, string> => {
  const origin = request.headers.get('origin') ?? ''
  const allowed = allowedOriginList(env)
  const list = allowed.length ? allowed : ['*']
  if (!origin) return {}
  if (!list.includes('*') && !list.includes(origin)) return {}
  return {
    'access-control-allow-origin': list.includes('*') ? '*' : origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

const clientKey = (request: Request): string =>
  request.headers.get('cf-connecting-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'anonymous'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      const config = readConfig(env)
      return json(
        {
          ok: true,
          configured: config.configured,
          provider: config.configured ? config.config.provider : null,
          model: config.configured ? config.config.model : null,
          promptVersion: PROMPT_VERSION,
          ...(config.configured ? {} : { reason: config.reason }),
        },
        200,
        cors,
      )
    }

    if (url.pathname !== '/v1/analyze') {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'not found', retryable: false } },
        404,
        cors,
      )
    }
    if (request.method !== 'POST') {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'method not allowed', retryable: false } },
        405,
        { ...cors, allow: 'POST' },
      )
    }

    const rawBody = await request.text()
    if (rawBody.length > LIMITS.bodyBytesMax) {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'request body is too large', retryable: false } },
        400,
        cors,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'request body must be valid JSON', retryable: false } },
        400,
        cors,
      )
    }

    const consent = (parsed as { consent?: { allow_ai_notes?: unknown } })?.consent
    if (consent?.allow_ai_notes !== true) {
      return json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'consent.allow_ai_notes must be true before a note can be analysed',
            retryable: false,
          },
        },
        400,
        cors,
      )
    }

    const config = readConfig(env)
    if (!config.configured) {
      return json(
        {
          error: {
            code: 'AI_NOT_CONFIGURED',
            message: `AI is not configured (${config.reason})`,
            retryable: false,
          },
        },
        503,
        cors,
      )
    }

    const validated = validateAnalyzeRequest(parsed)
    if (!validated.ok) {
      return json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'request failed validation',
            retryable: false,
            ...(config.config.debug ? { detail: validated.errors.join(' | ') } : {}),
          },
        },
        400,
        cors,
      )
    }

    const decision = limiter.check(clientKey(request), Date.now())
    if (!decision.ok) {
      return json(
        { error: { code: 'RATE_LIMITED', message: 'too many analysis requests', retryable: true } },
        429,
        { ...cors, 'retry-after': String(decision.retryAfterSec) },
      )
    }

    try {
      const result = await analyzeFilm(validated.value, {
        provider: createProvider(config.config),
        now: () => new Date(),
      })
      return json(result, 200, cors)
    } catch (error) {
      if (error instanceof AIError) {
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              retryable: error.retryable,
              ...(config.config.debug && error.detail ? { detail: error.detail } : {}),
            },
          },
          STATUS[error.code] ?? 500,
          cors,
        )
      }
      return json(
        { error: { code: 'INTERNAL', message: 'unexpected worker error', retryable: true } },
        500,
        cors,
      )
    }
  },
}
