/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public base URL of the AI Core API (Cloudflare Worker or local Node).
   * This is a URL, never a model API key.
   */
  readonly VITE_AI_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
