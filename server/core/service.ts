import { LIMITS, PROMPT_VERSION } from './contract.ts'
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts'
import { extractJson } from './json.ts'
import { ProviderError, type AIProvider, type ChatMessage } from './provider.ts'
import { validateModelAnalysis } from './validate.ts'
import type { AIErrorCode, AnalyzeRequest, AnalyzeResponse, AnalysisMeta, ModelAnalysis } from './types.ts'

export class AIError extends Error {
  readonly code: AIErrorCode
  readonly retryable: boolean
  readonly detail?: string
  constructor(code: AIErrorCode, message: string, retryable: boolean, detail?: string) {
    super(message)
    this.name = 'AIError'
    this.code = code
    this.retryable = retryable
    this.detail = detail
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isTransient = (error: unknown): boolean => {
  if (!(error instanceof ProviderError)) return false
  if (error.kind === 'timeout') return true
  if (error.kind !== 'upstream') return false
  return error.status === 429 || (typeof error.status === 'number' && error.status >= 500)
}

export type AnalyzeDeps = {
  provider: AIProvider
  now?: () => Date
}

const callProvider = async (
  provider: AIProvider,
  messages: ChatMessage[],
  signal: AbortSignal,
  now: () => Date,
): Promise<{ text: string; provider: string; model: string; latencyMs: number }> => {
  const started = now().getTime()
  let attempt = 0
  for (;;) {
    attempt += 1
    try {
      const result = await provider.complete(messages, {
        signal,
        json: true,
        maxTokens: LIMITS.maxOutputTokens,
        temperature: 0.2,
      })
      return { ...result, latencyMs: now().getTime() - started }
    } catch (error) {
      if (attempt < 2 && isTransient(error)) {
        await sleep(900)
        continue
      }
      throw error
    }
  }
}

export const analyzeFilm = async (
  request: AnalyzeRequest,
  deps: AnalyzeDeps,
): Promise<AnalyzeResponse> => {
  const now = deps.now ?? (() => new Date())
  const controller = new AbortController()
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(request) },
  ]

  let lastErrors: string[] = []
  let lastRaw = ''
  let attempts = 0
  const started = now().getTime()

  for (let round = 0; round < 2; round += 1) {
    attempts += 1
    let completion
    try {
      completion = await callProvider(deps.provider, messages, controller.signal, now)
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.kind === 'timeout') {
          throw new AIError('UPSTREAM_TIMEOUT', 'model provider timed out', true)
        }
        if (error.kind === 'config') {
          throw new AIError(
            'AI_NOT_CONFIGURED',
            'the configured API key was rejected by the provider',
            false,
          )
        }
        throw new AIError('UPSTREAM_ERROR', 'model provider request failed', true, error.message)
      }
      throw new AIError('UPSTREAM_ERROR', 'model provider request failed', true)
    }

    lastRaw = completion.text
    const parsed = extractJson(completion.text)
    if (!parsed.ok) {
      lastErrors = [parsed.error]
    } else {
      const validated = validateModelAnalysis(parsed.value, {
        note: request.note,
        historyIds: (request.history ?? []).map((item) => item.id),
      })
      if (validated.ok) {
        const meta: AnalysisMeta = {
          provider: completion.provider,
          model: completion.model,
          promptVersion: PROMPT_VERSION,
          analyzedAt: now().toISOString(),
          latencyMs: now().getTime() - started,
          inputChars: request.note.length,
          attempts,
        }
        return { analysis: validated.value as ModelAnalysis, meta }
      }
      lastErrors = validated.errors
    }

    if (round === 0) {
      messages.push({ role: 'assistant', content: lastRaw.slice(0, 2000) })
      messages.push({ role: 'user', content: buildRepairPrompt(lastErrors) })
    }
  }

  throw new AIError(
    'INVALID_MODEL_OUTPUT',
    'the model did not return a valid structured analysis',
    true,
    lastErrors.slice(0, 6).join(' | ') || undefined,
  )
}
