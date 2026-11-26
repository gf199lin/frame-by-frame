import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIMITS, PROMPT_VERSION } from './core/contract.ts'
import { readConfig, type AIConfig, type Env } from './core/env.ts'
import { AIError, analyzeFilm } from './core/service.ts'
import { RateLimiter } from './core/rateLimit.ts'
import { createProvider, type AIProvider } from './core/provider.ts'
import { validateAnalyzeRequest } from './core/validate.ts'
import { buildAgentRun, validateAgentRunV2 } from './core/agentRun.ts'
import {
  isAgentRunInProgress,
  resolveEnginePath,
  runFilmCurator,
} from './core/agentBridge.ts'
import type { AIErrorCode, ErrorEnvelope } from './core/types.ts'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_MODEL = process.env.DEEPWORKS_AGENT_MODEL ?? 'dth/DeepSeek-V4.1-Flash'
const AGENT_NAME = 'film-curator'

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

const errorResponse = (
  code: AIErrorCode,
  message: string,
  retryable: boolean,
  detail?: string,
  requestId?: string,
): Response => {
  const body: ErrorEnvelope = {
    error: {
      code,
      message,
      retryable,
      ...(detail ? { detail } : {}),
      ...(requestId ? { request_id: requestId } : {}),
    },
  }
  return json(body, STATUS_BY_CODE[code])
}

const optionalString = (body: unknown, key: string): string => {
  if (typeof body !== 'object' || body === null) return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

const newId = (prefix: string): string =>
  `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

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

    if (url.pathname === '/v1/agent/status' && request.method === 'GET') {
      const enginePath = resolveEnginePath()
      return json(
        {
          available: existsSync(enginePath),
          busy: isAgentRunInProgress(),
          agent: AGENT_NAME,
          model: AGENT_MODEL,
          enginePath,
        },
        200,
        corsHeader,
      )
    }

    if (url.pathname === '/v1/agent/analyze') {
      if (request.method !== 'POST') {
        return json(
          { error: { code: 'BAD_REQUEST', message: 'method not allowed', retryable: false } },
          405,
          { ...corsHeader, allow: 'POST' },
        )
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
              ...(configResult.configured && configResult.config.debug
                ? { detail: validated.errors.join(' | ') }
                : {}),
            },
          },
          400,
          corsHeader,
        )
      }

      const stamp = now()
      const compact = stamp.toISOString().replace(/[-:T]/g, '').slice(0, 14)
      const runId = `fbf-web-${compact}-${Math.random().toString(36).slice(2, 6)}`

      const result = await runFilmCurator(
        {
          runId,
          film: validated.value.film,
          rating: validated.value.rating,
          feltLike: validated.value.feltLike,
          note: validated.value.note,
          history: (validated.value.history ?? []).map((item) => ({ ...item })),
          locale: validated.value.locale,
        },
        {
          projectRoot: PROJECT_ROOT,
          model: AGENT_MODEL,
          agent: AGENT_NAME,
          timeoutMs: 420_000,
        },
      )

      if (!result.ok) {
        const mapped: Record<
          string,
          { status: number; code: AIErrorCode; message: string; retryable: boolean }
        > = {
          ENGINE_NOT_FOUND: {
            status: 503,
            code: 'AI_NOT_CONFIGURED',
            message: '本机没有找到 DeepWorks 引擎，无法运行 film-curator。',
            retryable: false,
          },
          BUSY: {
            status: 429,
            code: 'RATE_LIMITED',
            message: '已有一个 DeepWorks Agent 分析在运行，请等它结束。',
            retryable: true,
          },
          TIMEOUT: {
            status: 504,
            code: 'UPSTREAM_TIMEOUT',
            message: 'DeepWorks Agent 超过 7 分钟没有完成。',
            retryable: true,
          },
          ENGINE_FAILED: {
            status: 502,
            code: 'UPSTREAM_ERROR',
            message: 'DeepWorks Agent 执行失败，没有产出最终结果。',
            retryable: true,
          },
          NO_RESULT: {
            status: 502,
            code: 'UPSTREAM_ERROR',
            message: 'DeepWorks Agent 结束了但没有写出结果文件。',
            retryable: true,
          },
        }
        const target = mapped[result.reason] ?? mapped.ENGINE_FAILED
        log({
          event: 'agent_analysis_error',
          runId,
          reason: result.reason,
          durationMs: result.durationMs,
          exitCode: result.exitCode ?? null,
        })
        return json(
          {
            error: {
              code: target.code,
              message: target.message,
              retryable: target.retryable,
              detail: result.detail,
              run_id: runId,
            },
          },
          target.status,
          corsHeader,
        )
      }

      log({
        event: 'agent_analysis_ok',
        runId,
        agent: result.agent,
        model: result.model,
        durationMs: result.durationMs,
        noteChars: validated.value.note.length,
        history: validated.value.history?.length ?? 0,
        kbStatus: (result.run as Record<string, unknown>).kb_status ?? null,
      })

      return json(
        {
          provider: 'deepworks',
          platform: 'DeepWorks',
          agent: result.agent,
          model: result.model,
          run_id: runId,
          duration_ms: result.durationMs,
          final_path: result.finalPath,
          run: result.run,
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

    const requestId = optionalString(parsedBody, 'request_id') || newId('req')
    const recordId = optionalString(parsedBody, 'record_id')

    const validated = validateAnalyzeRequest(parsedBody)
    if (!validated.ok) {
      return json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'request failed validation',
            retryable: false,
            request_id: requestId,
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
            request_id: requestId,
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
      const runId = newId('run')
      const startedAt = new Date(started).toISOString()
      // The legacy fields stay untouched. A v2 run is attached only when the
      // caller supplied a record_id, so old clients keep working unchanged.
      const built = recordId
        ? buildAgentRun({
            requestId,
            recordId,
            runId,
            filmId: validated.value.film.id,
            response: result,
            startedAt,
          })
        : null
      const checked = built ? validateAgentRunV2(built) : null
      if (checked && !checked.ok) {
        log({ event: 'invalid_agent_run', requestId, runId, errors: checked.errors })
        return errorResponse(
          'INTERNAL',
          'agent run failed validation',
          false,
          config.debug ? checked.errors.join(' | ') : undefined,
          requestId,
        )
      }
      log({
        event: 'analysis_ok',
        requestId,
        runId,
        provider: result.meta.provider,
        providerId: result.meta.providerId,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
        attempts: result.meta.attempts,
        noteChars: validated.value.note.length,
        history: validated.value.history?.length ?? 0,
        durationMs: now().getTime() - started,
      })
      return json({ ...result, ...(checked?.ok ? { run: checked.value } : {}) }, 200, corsHeader)
    } catch (error) {
      if (error instanceof AIError) {
        log({
          event: 'analysis_error',
          requestId,
          code: error.code,
          retryable: error.retryable,
          durationMs: now().getTime() - started,
        })
        return errorResponse(
          error.code,
          error.message,
          error.retryable,
          config.debug && error.detail ? error.detail : undefined,
          requestId,
        )
      }
      log({ event: 'analysis_crash', requestId, durationMs: now().getTime() - started })
      return errorResponse('INTERNAL', 'unexpected server error', true, undefined, requestId)
    }
  }
}
