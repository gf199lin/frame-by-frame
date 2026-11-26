import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser client for Supabase.
 *
 * Only public values live here: the project URL and the anon/publishable key.
 * Access control is enforced by Row Level Security in Postgres, never by
 * hiding this key. The service_role / secret key must never reach the bundle.
 */

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** Trailing slashes would produce `//auth/v1` paths, so normalise them away. */
export const SUPABASE_URL = rawUrl.replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = rawKey

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

export const SUPABASE_CONFIG_HINT =
  '请在项目根目录的 .env.local 中填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，然后重启开发服务器。'

let client: SupabaseClient | null = null

/**
 * Returns the singleton client, or null when the environment is incomplete.
 * Callers must render a configuration notice instead of pretending to be
 * signed in — there is no offline "fake auth" mode.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'frame-by-frame' },
      },
    })
  }
  return client
}

/** For auth screens: the client is required, and a missing config is a bug. */
export const requireSupabaseClient = (): SupabaseClient => {
  const instance = getSupabaseClient()
  if (!instance) throw new Error(SUPABASE_CONFIG_HINT)
  return instance
}
