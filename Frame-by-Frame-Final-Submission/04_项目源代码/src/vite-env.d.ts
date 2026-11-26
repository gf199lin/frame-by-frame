/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public base URL of the AI Core API (Cloudflare Worker or local Node).
   * This is a URL, never a model API key.
   */
  readonly VITE_AI_API_BASE?: string
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon / publishable key. Public by design; RLS enforces access. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
