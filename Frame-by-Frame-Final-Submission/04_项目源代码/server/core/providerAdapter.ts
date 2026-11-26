import { analyzeFilm, type AnalyzeDeps } from './service.ts'
import type { AnalysisProviderId, AnalyzeRequest, AnalyzeResponse } from './types.ts'

/**
 * Server-side provider adapter.
 *
 * The gateway owns provider selection. A provider may only claim the identity
 * of the service that actually executed the analysis; `deepworks` stays
 * unconfigured until an official endpoint exists.
 */

export type ProviderDescriptor = {
  id: AnalysisProviderId
  label: string
  configured: boolean
  reason?: string
}

export class ProviderNotConfiguredError extends Error {
  readonly provider: AnalysisProviderId
  constructor(provider: AnalysisProviderId, message: string) {
    super(message)
    this.name = 'ProviderNotConfiguredError'
    this.provider = provider
  }
}

export type AnalysisProviderAdapter = {
  readonly id: AnalysisProviderId
  describe(): ProviderDescriptor
  analyze(request: AnalyzeRequest, deps: AnalyzeDeps): Promise<AnalyzeResponse>
}

/** The existing DeepSeek pipeline. Never labelled as DeepWorks. */
export class LegacyDeepSeekAdapter implements AnalysisProviderAdapter {
  readonly id = 'legacy-deepseek' as const
  private readonly configured: boolean
  private readonly reason?: string

  constructor(configured: boolean, reason?: string) {
    this.configured = configured
    this.reason = reason
  }

  describe(): ProviderDescriptor {
    return {
      id: this.id,
      label: 'Legacy DeepSeek',
      configured: this.configured,
      ...(this.reason ? { reason: this.reason } : {}),
    }
  }

  async analyze(request: AnalyzeRequest, deps: AnalyzeDeps): Promise<AnalyzeResponse> {
    const result = await analyzeFilm(request, deps)
    return {
      ...result,
      meta: { ...result.meta, providerId: this.id },
    }
  }
}

/**
 * Reserved for the future official integration. It has no URL, no token and no
 * execution path on purpose: returning a fabricated result would misrepresent
 * where the analysis ran.
 */
export class DeepWorksAdapter implements AnalysisProviderAdapter {
  readonly id = 'deepworks' as const

  describe(): ProviderDescriptor {
    return {
      id: this.id,
      label: 'DeepWorks Agent',
      configured: false,
      reason: 'no official cloud agent endpoint has been confirmed',
    }
  }

  async analyze(): Promise<AnalyzeResponse> {
    throw new ProviderNotConfiguredError(
      this.id,
      'DeepWorks agent endpoint is not configured. No official API is available yet.',
    )
  }
}

export const createProviderAdapter = (options: {
  provider?: string
  configured?: boolean
  reason?: string
}): AnalysisProviderAdapter => {
  if (options.provider === 'deepworks') return new DeepWorksAdapter()
  return new LegacyDeepSeekAdapter(options.configured !== false, options.reason)
}
