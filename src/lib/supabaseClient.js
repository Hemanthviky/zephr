import { createClient } from '@supabase/supabase-js'

/**
 * Supabase browser client.
 *
 * Credentials come from Vite env vars only — never inline them here, and never
 * use the `service_role` key in client code (it bypasses Row Level Security).
 * See `.env.example`, and README §2 for where to find these values.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * A missing .env is by far the most common first-run failure, and it otherwise
 * surfaces as an opaque "Failed to fetch". We detect it up front and let the UI
 * render a real setup message instead.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Zephr] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n' +
      'Copy .env.example to .env, fill both values, then restart `npm run dev`.'
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'zephr.auth',
      },
    })
  : null

/**
 * Supabase errors are not user-facing English. Translate the handful we can
 * actually anticipate, and fall back to the raw message so nothing is swallowed.
 */
export function friendlyError(error, fallback = 'Something went wrong. Try again?') {
  if (!error) return fallback

  const message = (error.message || '').toLowerCase()

  if (!isSupabaseConfigured) {
    return 'Supabase isn’t configured yet — add your project URL and anon key to .env.'
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return 'Can’t reach the server. Check your connection and try again.'
  }
  if (message.includes('invalid login credentials')) {
    return 'That email and password don’t match. Try again?'
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'That email already has an account — log in instead.'
  }
  if (message.includes('password should be at least')) {
    return 'Password needs to be at least 6 characters.'
  }
  if (message.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email first.'
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Give it a minute, then try again.'
  }
  if (message.includes('row-level security') || message.includes('violates row-level')) {
    return 'That save was rejected by the database. Did schema.sql run successfully?'
  }
  return error.message || fallback
}
