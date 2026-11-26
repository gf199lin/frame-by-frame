/**
 * Human-readable labels for the provenance of one analysis.
 *
 * The local rule engine must never be presented as an AI/model result, so the
 * label is the single place every surface reads its wording from.
 */
export const analysisSourceLabel = (provider: string): string => {
  switch (provider) {
    case 'legacy-deepseek':
      return 'DeepSeek AI 分析'
    case 'deepworks':
      return 'DeepWorks Agent · film-curator'
    case 'local-engine':
      return '本地规则引擎分析'
    case 'seed':
      return '内置示例（编辑撰写）'
    case 'stub':
      return 'Stub（仅测试）'
    default:
      return provider
  }
}

/** True only for providers that actually ran a model or an agent. */
export const isModelProvider = (provider: string): boolean =>
  provider === 'legacy-deepseek' || provider === 'deepworks'
