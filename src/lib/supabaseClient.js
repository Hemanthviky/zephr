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

/* ────────────────────────────────────────────────────────────────────────────
   "Remember me"

   Supabase decides where to keep a session once, at client construction, so a
   per-login choice has to come from a storage adapter that picks its own
   backing store at write time:

     remembered  → localStorage,   survives closing the browser
     not         → sessionStorage, dies with the tab

   Reads check sessionStorage first, so a deliberately temporary session is
   never shadowed by a stale remembered one. Both stores throw in Safari
   private mode and with cookies blocked, hence the probe and the in-memory
   fallback — a login that can't be persisted should still work for the tab
   you're in rather than crashing on the first write.
   ──────────────────────────────────────────────────────────────────────────── */

const REMEMBER_KEY = 'zephr.remember'

function usableStorage(get) {
  try {
    const store = get()
    const probe = '__zephr_probe__'
    store.setItem(probe, '1')
    store.removeItem(probe)
    return store
  } catch {
    return null
  }
}

const localStore = usableStorage(() => window.localStorage)
const sessionStore = usableStorage(() => window.sessionStorage)
const memoryStore = new Map()

/** Defaults to true — the friendlier answer, and what the app did before. */
export function getRememberMe() {
  try {
    return localStore?.getItem(REMEMBER_KEY) !== 'false'
  } catch {
    return true
  }
}

/** Call this *before* signing in; the next token write reads it. */
export function setRememberMe(remember) {
  try {
    localStore?.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  } catch {
    /* nothing to do — the adapter below falls back to memory */
  }
}

const authStorage = {
  getItem(key) {
    return sessionStore?.getItem(key) ?? localStore?.getItem(key) ?? memoryStore.get(key) ?? null
  },
  setItem(key, value) {
    const remember = getRememberMe()
    const target = remember ? localStore : sessionStore
    const other = remember ? sessionStore : localStore

    // Drop the copy in the store we're no longer using, or switching
    // "remember me" off would leave a working token behind in localStorage.
    try {
      other?.removeItem(key)
    } catch {
      /* ignore */
    }

    if (target) target.setItem(key, value)
    else memoryStore.set(key, value)
  },
  removeItem(key) {
    localStore?.removeItem(key)
    sessionStore?.removeItem(key)
    memoryStore.delete(key)
  },
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'zephr.auth',
        storage: authStorage,
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
  // Reset links are rate-limited separately, and the raw message ("For security
  // purposes, you can only request this after 51 seconds") reads like a telling-off.
  if (message.includes('for security purposes') || message.includes('only request this')) {
    return 'That link was just sent. Give it a minute before asking for another.'
  }
  if (message.includes('should be different from the old password')) {
    return 'That’s your current password — pick a different one.'
  }
  // A recovery link that's expired, been used already, or had its session
  // dropped by a refresh in a different browser than the one that opened it.
  if (
    message.includes('auth session missing') ||
    message.includes('token has expired or is invalid') ||
    message.includes('otp_expired')
  ) {
    return 'That reset link has expired or been used. Ask for a fresh one.'
  }
  if (message.includes('row-level security') || message.includes('violates row-level')) {
    return 'That save was rejected by the database. Did schema.sql run successfully?'
  }
  // A table or column the app expects isn't there — which on an existing
  // project means schema.sql has gained something since it was last run.
  if (
    message.includes('could not find the table') ||
    message.includes('could not find the') ||
    message.includes('does not exist')
  ) {
    return 'Your database is missing something this needs. Re-run supabase/schema.sql in the Supabase SQL editor.'
  }
  return error.message || fallback
}
