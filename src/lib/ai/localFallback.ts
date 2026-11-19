/**
 * When the online provider is missing or fails, the add/edit flow still needs
 * to stay usable. The local rule engine is a fallback only: it never replaces a
 * successful model run, and every surface that shows it must say so.
 */
export type FallbackReason = 'not_configured' | 'request_failed'

export const FALLBACK_NOTICE: Record<FallbackReason, string> = {
  not_configured:
    '在线 AI 还没有连接，这次改用本地规则引擎生成解读，没有调用任何模型。',
  request_failed:
    '在线 AI 没有返回结果，这次先用本地规则引擎生成解读，没有调用任何模型。',
}

/** Short badge text shown next to a fallback result. */
export const FALLBACK_BADGE = '本地规则引擎 · 未调用模型'
