import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiErrorCode,
  AiHealth,
} from './types'
import { validateAnalyzeResponse } from './validate'

const DEFAULT_DEV_BASE = 'http://127.0.0.1:8787'
const RAW_BASE = (import.meta.env.VITE_AI_API_BASE ?? '').trim()

/**
 * The Worker/Node API origin. This is a public URL — never a secret. Model
 * credentials live only in the server environment.
 */
export const AI_BASE_URL: string = (RAW_BASE || (import.meta.env.DEV ? DEFAULT_DEV_BASE : '')).replace(
  /\/+$/,
  '',
)

export const isAiConfigured = (): boolean => AI_BASE_URL.length > 0

const MESSAGES: Record<AiErrorCode, string> = {
  BAD_REQUEST: '这次请求没有通过校验，请检查评分和笔记后重试。',
  AI_NOT_CONFIGURED:
    'AI 分析服务还没有配置。你仍然可以保存这部电影和笔记，之后再进行分析。',
  RATE_LIMITED: '请求有点频繁，请等一分钟再试。你的记录不会丢失。',
  UPSTREAM_TIMEOUT: '模型响应超时。你的笔记没有被发送第二次，可以稍后重试。',
  UPSTREAM_ERROR: 'AI 服务暂时不可用。你的记录不会丢失，可以稍后重试。',
  INVALID_MODEL_OUTPUT: 'AI 返回的结构不完整，系统已拒绝保存这次分析。可以重试。',
  CLIENT_VALIDATION: 'AI 返回的数据没有通过结构校验，已拒绝保存。可以重试。',
  INTERNAL: 'AI 服务出现内部错误。你的记录不会丢失，可以稍后重试。',
  NETWORK: '无法连接到 AI 服务。如果在本机开发，请先运行 npm run ai:dev。',
}

const RETRYABLE: Record<AiErrorCode, boolean> = {
  BAD_REQUEST: false,
  AI_NOT_CONFIGURED: false,
  RATE_LIMITED: true,
  UPSTREAM_TIMEOUT: true,
  UPSTREAM_ERROR: true,
  INVALID_MODEL_OUTPUT: true,
  CLIENT_VALIDATION: true,
  INTERNAL: true,
  NETWORK: true,
}

export class AiRequestError extends Error {
  readonly code: AiErrorCode
  readonly retryable: boolean
  readonly status?: number
  constructor(code: AiErrorCode, message?: string, status?: number, retryable?: boolean) {
    super(message ?? MESSAGES[code])
    this.name = 'AiRequestError'
    this.code = code
    this.status = status
    this.retryable = retryable ?? RETRYABLE[code]
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isErrorEnvelope = (value: unknown): value is { error: { code?: string; message?: string; retryable?: boolean } } =>
  typeof value === 'object' && value !== null && 'error' in value

const toErrorCode = (value: string | undefined): AiErrorCode => {
  const allowed: AiErrorCode[] = [
    'BAD_REQUEST',
    'AI_NOT_CONFIGURED',
    'RATE_LIMITED',
    'UPSTREAM_TIMEOUT',
    'UPSTREAM_ERROR',
    'INVALID_MODEL_OUTPUT',
    'INTERNAL',
  ]
  return allowed.find((code) => code === value) ?? 'UPSTREAM_ERROR'
}

const requestOnce = async (
  payload: AiAnalyzeRequest,
  externalSignal?: AbortSignal,
): Promise<AiAnalyzeResponse> => {
  if (!isAiConfigured()) throw new AiRequestError('AI_NOT_CONFIGURED')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), 55_000)
  const onAbort = () => controller.abort('cancelled')
  if (externalSignal?.aborted) controller.abort('cancelled')
  else externalSignal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(`${AI_BASE_URL}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const raw = await response.json().catch(() => null)

    if (!response.ok) {
      if (isErrorEnvelope(raw)) {
        const code = toErrorCode(raw.error.code)
        throw new AiRequestError(code, undefined, response.status, raw.error.retryable)
      }
      throw new AiRequestError(
        response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
        undefined,
        response.status,
      )
    }

    const validated = validateAnalyzeResponse(raw, {
      note: payload.note,
      historyIds: payload.history.map((item) => item.id),
    })
    if (!validated.ok) {
      throw new AiRequestError(
        'CLIENT_VALIDATION',
        `AI 返回的数据没有通过校验：${validated.errors.slice(0, 2).join('；')}`,
      )
    }
    return validated.value
  } catch (error) {
    if (error instanceof AiRequestError) throw error
    if ((error as Error)?.name === 'AbortError') {
      if (externalSignal?.aborted) throw new AiRequestError('NETWORK', '分析已取消。', undefined, false)
      throw new AiRequestError('UPSTREAM_TIMEOUT')
    }
    throw new AiRequestError('NETWORK')
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onAbort)
  }
}

export const analyzeFilmMemory = async (
  payload: AiAnalyzeRequest,
  options: { signal?: AbortSignal } = {},
): Promise<AiAnalyzeResponse> => {
  try {
    return await requestOnce(payload, options.signal)
  } catch (error) {
    const failure = error as AiRequestError
    if (!failure?.retryable || options.signal?.aborted) throw failure
    // One retry for transient failures only; validation failures are not retried
    // here because the server already attempted a repair pass.
    if (failure.code !== 'NETWORK' && failure.code !== 'UPSTREAM_TIMEOUT') throw failure
    await sleep(850)
    return requestOnce(payload, options.signal)
  }
}

export const checkAiHealth = async (): Promise<AiHealth | null> => {
  if (!isAiConfigured()) return null
  try {
    const response = await fetch(`${AI_BASE_URL}/health`, { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return (await response.json()) as AiHealth
  } catch {
    return null
  }
}

export const aiErrorMessage = (error: unknown): string =>
  error instanceof AiRequestError ? error.message : 'AI 分析失败，可以稍后重试。'

export const aiErrorCode = (error: unknown): AiErrorCode | null =>
  error instanceof AiRequestError ? error.code : null
