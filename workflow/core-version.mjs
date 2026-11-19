/**
 * AI Core version identifiers (single source of truth for DeepWorks-side runs).
 *
 * Values are informational: `workflow/validate-run.mjs` only checks that these
 * fields are non-empty strings when present. No acceptance gate depends on them
 * yet, so adding them cannot invalidate runs produced before AI Core v1.0.0.
 *
 * The website side keeps its own constants in `server/core/contract.ts`
 * (PROMPT_VERSION / SCHEMA_VERSION); `CORE_SPEC_VERSION` is the shared layer
 * above both.
 */
export const CORE_SPEC_VERSION = '1.0.0'
export const AGENT_VERSION = 'film-curator/1.0.0'
export const WORKFLOW_VERSION = 'seven-step/1.0.0'
export const DEEPWORKS_PROFILE_ALGORITHM_VERSION = 'weighted-evidence-shrinkage-v2'
/** Assigned by AI Core v1.0.0; the website code has no equivalent constant yet. */
export const WEBSITE_PROFILE_ALGORITHM_VERSION = 'website-state-aggregate-v1'
export const WEBSITE_PROMPT_VERSION = 'fbf-ai-1.0.0'
export const WEBSITE_SCHEMA_VERSION = 1
