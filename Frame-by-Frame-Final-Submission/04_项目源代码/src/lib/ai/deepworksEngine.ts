import { AI_BASE_URL, AiRequestError, isAiConfigured } from './client'
import type { AiAnalyzeRequest } from './types'

/**
 * Triggers the project's own `film-curator` agent through the local bridge.
 *
 * The bridge only spawns the installed DeepWorks engine CLI; the reasoning,
 * skills, knowledge base and quality gates all run inside DeepWorks. Nothing
 * here talks to a model vendor directly.
 */

export type FilmCuratorRunMeta = {
  provider: 'deepworks'
  platform: 'DeepWorks'
  agent: string
  model: string
  run_id: string
  duration_ms: number
  final_path?: string
}

export type FilmCuratorRun = {
  meta: FilmCuratorRunMeta
  /** Raw P0 archive written by the agent. */
  p0: Record<string, unknown>
}

const AGENT_TIMEOUT_MS = 430_000

const isErrorEnvelope = (
  value: unknown,
): value is { error: { code?: string; message?: string; retryable?: boolean; detail?: string } } =>
  typeof value === 'object' && value !== null && 'error' in value

export const isFilmCuratorAvailable = async (): Promise<boolean> => {
  if (!isAiConfigured()) return false
  try {
    const response = await fetch(`${AI_BASE_URL}/v1/agent/status`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return false
    const body = (await response.json()) as { available?: boolean }
    return body.available === true
  } catch {
    return false
  }
}

export const analyzeWithFilmCurator = async (
  payload: AiAnalyzeRequest,
  options: { signal?: AbortSignal } = {},
): Promise<FilmCuratorRun> => {
  if (!isAiConfigured()) throw new AiRequestError('AI_NOT_CONFIGURED')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), AGENT_TIMEOUT_MS)
  const onAbort = () => controller.abort('cancelled')
  if (options.signal?.aborted) controller.abort('cancelled')
  else options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(`${AI_BASE_URL}/v1/agent/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const raw = await response.json().catch(() => null)

    if (!response.ok) {
      if (isErrorEnvelope(raw)) {
        const code = raw.error.code
        const known: string[] = [
          'BAD_REQUEST',
          'AI_NOT_CONFIGURED',
          'RATE_LIMITED',
          'UPSTREAM_TIMEOUT',
          'UPSTREAM_ERROR',
          'INVALID_MODEL_OUTPUT',
          'INTERNAL',
        ]
        const mapped = (known.includes(code ?? '') ? code : 'UPSTREAM_ERROR') as
          | 'BAD_REQUEST'
          | 'AI_NOT_CONFIGURED'
          | 'RATE_LIMITED'
          | 'UPSTREAM_TIMEOUT'
          | 'UPSTREAM_ERROR'
          | 'INVALID_MODEL_OUTPUT'
          | 'INTERNAL'
        throw new AiRequestError(
          mapped,
          raw.error.message,
          response.status,
          raw.error.retryable,
        )
      }
      throw new AiRequestError(
        response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
        undefined,
        response.status,
      )
    }

    if (typeof raw !== 'object' || raw === null || !('run' in raw)) {
      throw new AiRequestError('INVALID_MODEL_OUTPUT', 'DeepWorks Agent 没有返回结果文件。')
    }

    const body = raw as Record<string, unknown>
    return {
      meta: {
        provider: 'deepworks',
        platform: 'DeepWorks',
        agent: String(body.agent ?? 'film-curator'),
        model: String(body.model ?? 'dth/DeepSeek-V4.1-Flash'),
        run_id: String(body.run_id ?? ''),
        duration_ms: Number(body.duration_ms ?? 0),
        ...(typeof body.final_path === 'string' ? { final_path: body.final_path } : {}),
      },
      p0: body.run as Record<string, unknown>,
    }
  } catch (error) {
    if (error instanceof AiRequestError) throw error
    if ((error as Error)?.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new AiRequestError('NETWORK', '分析已取消。', undefined, false)
      }
      throw new AiRequestError(
        'UPSTREAM_TIMEOUT',
        'DeepWorks Agent 超过 7 分钟没有完成，请稍后重试。',
      )
    }
    throw new AiRequestError('NETWORK', '无法连接本机 DeepWorks 桥接服务。')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
