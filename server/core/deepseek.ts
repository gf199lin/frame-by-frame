import type { AIConfig } from './env.ts'
import { ProviderError, type AIProvider, type ChatMessage, type CompletionOptions, type CompletionResult } from './provider.ts'

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>
  model?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek'
  readonly model: string
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.model = config.model
    this.timeoutMs = config.timeoutMs
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const onAbort = () => controller.abort()
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: false,
          ...(options.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      })

      if (response.status === 401 || response.status === 403) {
        throw new ProviderError('config', 'model provider rejected the API key', response.status)
      }
      if (response.status === 429) {
        throw new ProviderError('upstream', 'model provider rate limited the request', 429)
      }
      if (!response.ok) {
        // Never forward provider response bodies: they can echo request content.
        throw new ProviderError('upstream', `model provider returned ${response.status}`, response.status)
      }

      const payload = (await response.json()) as DeepSeekResponse
      const content = payload.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new ProviderError('upstream', 'model provider returned an empty completion')
      }
      return {
        text: content,
        provider: this.name,
        model: payload.model ?? this.model,
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      if ((error as Error)?.name === 'AbortError') {
        throw new ProviderError('timeout', 'model provider timed out')
      }
      throw new ProviderError('upstream', 'network error while calling the model provider')
    } finally {
      clearTimeout(timer)
      options.signal.removeEventListener('abort', onAbort)
    }
  }
}
