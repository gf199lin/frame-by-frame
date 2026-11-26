import type { AIConfig } from './env.ts'
import { DeepSeekProvider } from './deepseek.ts'
import { StubProvider } from './stub.ts'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type CompletionOptions = {
  signal: AbortSignal
  json: boolean
  maxTokens: number
  temperature: number
}

export type CompletionResult = {
  text: string
  provider: string
  model: string
}

export interface AIProvider {
  readonly name: string
  readonly model: string
  complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult>
}

export class ProviderError extends Error {
  readonly kind: 'timeout' | 'upstream' | 'config'
  readonly status?: number
  constructor(kind: 'timeout' | 'upstream' | 'config', message: string, status?: number) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.status = status
  }
}

export const createProvider = (config: AIConfig): AIProvider => {
  if (config.provider === 'stub') return new StubProvider()
  return new DeepSeekProvider(config)
}
