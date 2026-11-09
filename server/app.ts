import { LIMITS, PROMPT_VERSION } from './core/contract.ts'
import { readConfig, type AIConfig, type Env } from './core/env.ts'
import { AIError, analyzeFilm } from './core/service.ts'
import { RateLimiter } from './core/rateLimit.ts'
import { createProvider, type AIProvider } from './core/provider.ts'
import { validateAnalyzeRequest } from './core/validate.ts'
import type { AIErrorCode, ErrorEnvelope } from './core/types.ts'

export type AppDeps = {
  env: Env
  providerFactory?: (config: AIConfig) => AIProvider
  limiter?: RateLimiter
  now?: () => Date
  log?: (line: Record<string, unknown>) => void
}

const STATUS_BY_CODE: Record<AIErrorCode, number> = {
  BAD_REQUEST: 400,
  AI_NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  INVALID_MODEL_OUTPUT: 422,
  INTERNAL: 500,
}

const errorResponse = (code: AIErrorCode, message: string, retryable: boolean, detail?: string): Response => {
  const body: ErrorEnvelope = { error: { code, message, retryable, ...(detail ? { detail } : {}) } }
  return json(body, STATUS_BY_CODE[code])
}

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })

const corsHeaders = (request: Request, allowed: string[]): Record<string, string> => {
  const origin = request.headers.get('origin') ?? ''
  const allowAny = allowed.includes('*')
  const allowedOrigin = allowAny ? '*' : allowed.includes(origin) ? origin : ''
  return {
    ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
    ...(allowedOrigin === '*' ? {} : { vary: 'origin' }),
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, accept',
    'access-control-max-age': '86400',
  }
}

const clientKey = (request: Request): string => {
  const headers = request.headers
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'anonymous'
  )
}

export const createApp = (deps: AppDeps) => {
  const limiter = deps.limiter ?? new RateLimiter()
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? ((line) => console.log(JSON.stringify(line)))
  const configResult = readConfig(deps.env)
  const cors = (request: Request) =>
    corsHeaders(request, configResult.configured ? configResult.config.allowedOrigins : ['*'])

  return async (request: Request): Promise<Response> => {
    const started = now().getTime()
    const url = new URL(request.url)
    const corsHeader = cors(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeader })
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json(
        {
          ok: true,
          configured: configResult.configured,
          provider: configResult.configured ? configResult.config.provider : null,
          model: configResult.configured ? configResult.config.model : null,
          promptVersion: PROMPT_VERSION,
          ...(configResult.configured
            ? {}
            : { reason: configResult.reason }),
        },
        200,
        corsHeader,
      )
    }

    if (url.pathname === '/v1/analyze' && request.method !== 'POST') {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'method not allowed', retryable: false } },
        405,
        { ...corsHeader, allow: 'POST' },
      )
    }

    if (url.pathname !== '/v1/analyze') {
      return json(
        { error: { code: 'BAD_REQUEST', message: 'not found', retryable: false } },
        404,
        corsHeader,
      )
    }

    if (!configResult.configured) {
      log({ event: 'ai_not_configured', reason: configResult.reason })
      return errorResponse(
        'AI_NOT_CONFIGURED',
        configResult.reason === 'missing_key'
          ? 'AI service has no model credentials configured.'
          : 'The stub provider is disabled on this deployment.',
        false,
      )
    }
    const config = configResult.config

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > LIMITS.bodyBytesMax) {
      return errorResponse('BAD_REQUEST', 'request body is too large', false)
    }

    let rawBody: string
    try {
      rawBody = await request.text()
    } catch {
      return errorResponse('BAD_REQUEST', 'could not read request body', false)
    }
    if (rawBody.length > LIMITS.bodyBytesMax) {
      return errorResponse('BAD_REQUEST', 'request body is too large', false)
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return errorResponse('BAD_REQUEST', 'request body must be valid JSON', false)
    }

    const validated = validateAnalyzeRequest(parsedBody)
    if (!validated.ok) {
      return json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'request failed validation',
            retryable: false,
            ...(config.debug ? { detail: validated.errors.join(' | ') } : {}),
          },
        },
        400,
        corsHeader,
      )
    }

    const decision = limiter.check(clientKey(request), now().getTime())
    if (!decision.ok) {
      log({ event: 'rate_limited', reason: decision.reason })
      return json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'too many analysis requests',
            retryable: true,
          },
        },
        429,
        { ...corsHeader, 'retry-after': String(decision.retryAfterSec) },
      )
    }

    const provider =
      deps.providerFactory?.(config) ?? createProvider(config)

    try {
      const result = await analyzeFilm(validated.value, { provider, now })
      log({
        event: 'analysis_ok',
        provider: result.meta.provider,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
        attempts: result.meta.attempts,
        noteChars: validated.value.note.length,
        history: validated.value.history?.length ?? 0,
        durationMs: now().getTime() - started,
      })
      return json(result, 200, corsHeader)
    } catch (error) {
      if (error instanceof AIError) {
        log({
          event: 'analysis_error',
          code: error.code,
          retryable: error.retryable,
          durationMs: now().getTime() - started,
        })
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              retryable: error.retryable,
              ...(config.debug && error.detail ? { detail: error.detail } : {}),
            },
          },
          STATUS_BY_CODE[error.code],
          corsHeader,
        )
      }
      log({ event: 'analysis_crash', durationMs: now().getTime() - started })
      return json(
        { error: { code: 'INTERNAL', message: 'unexpected server error', retryable: true } },
        500,
        corsHeader,
      )
    }
  }
}
