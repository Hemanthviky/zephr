import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  supabase,
  isSupabaseConfigured,
  friendlyError,
  setRememberMe,
  getRememberMe,
} from '../lib/supabaseClient'

/**
 * What to call someone.
 *
 * The name they gave at signup, else the local part of their email tidied up
 * (`hemanth.viky` → `Hemanth Viky`), else a neutral fallback. Never renders as
 * an empty string, so callers can drop it straight into a greeting.
 */
export function displayName(user) {
  const given = user?.user_metadata?.full_name?.trim()
  if (given) return given

  const local = user?.email?.split('@')[0]
  if (!local) return 'there'

  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ') || 'there'
}

/** First name only, for the tighter spots. */
export function firstName(user) {
  return displayName(user).split(' ')[0]
}

/**
 * Did this page load land on a password-reset link?
 *
 * Read once at module load, and this is the only reliable moment to read it.
 * The client is created with `detectSessionInUrl`, so Supabase consumes
 * `#access_token=…&type=recovery` and scrubs the fragment during its own
 * startup — which can finish before React has mounted anything, let alone
 * before `onAuthStateChange` is subscribed below. Wait for the PASSWORD_RECOVERY
 * event alone and it may already have been emitted into an empty room.
 *
 * The event is still handled, for the case where it wins the race. This is the
 * belt to its braces, and the reason recovery survives a refresh of the page
 * mid-reset.
 */
function recoveryInUrl() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  if (!hash.includes('type=recovery')) return false
  return new URLSearchParams(hash.slice(1)).get('type') === 'recovery'
}

const ARRIVED_ON_RECOVERY = recoveryInUrl()

/**
 * The other thing a reset link can do: fail.
 *
 * An expired or already-used link doesn't come back as `type=recovery` — it
 * comes back as `#error=access_denied&error_code=otp_expired`, with no session
 * and nothing for the recovery branch to catch. Left alone that lands someone
 * on the plain login page with no explanation, which looks exactly like the
 * link having done nothing at all.
 *
 * Read at module load for the same reason as the above, and translated here
 * rather than passed through: `error_description` arrives URL-encoded and
 * sentence-cased by GoTrue ("Email link is invalid or has expired").
 */
function linkErrorInUrl() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash.includes('error')) return null

  const params = new URLSearchParams(hash.slice(1))
  const code = params.get('error_code')
  if (!code) return null

  if (code === 'otp_expired' || code === 'access_denied') {
    return 'That reset link has expired or been used already. Ask for a fresh one below.'
  }
  return params.get('error_description')?.replace(/\+/g, ' ') || 'That link didn’t work.'
}

/**
 * Captured once, at module load, and read from there afterwards.
 *
 * Calling `linkErrorInUrl()` again from a `useState` initialiser looks
 * equivalent and isn't: React runs that during the first render, which is late
 * enough that `detectSessionInUrl` has already scrubbed the fragment, so it
 * reliably returns null and the message never appears.
 */
const LINK_ERROR = linkErrorInUrl()

/** True when the page loaded on a dud link — App.jsx opens the request form. */
export const ARRIVED_ON_BAD_LINK = Boolean(LINK_ERROR)

/**
 * Session state + the auth actions the app needs.
 *
 * `loading` is true only for the very first "do we already have a session?"
 * check on boot — App.jsx uses it to hold the splash instead of flashing the
 * login screen at a user who is already signed in.
 *
 * `recovering` is the other flag App.jsx branches on. A reset link signs you
 * *in* — Supabase hands back a real session so that `updateUser` has something
 * to authenticate with — so without it, clicking "forgot password" would drop
 * you into the tracker with your old password still set, which is neither what
 * the link promised nor a state you can get out of.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Seeded so a dud reset link explains itself on arrival, rather than
  // dumping the user on a login page that looks like the link did nothing.
  const [error, setError] = useState(LINK_ERROR)
  const [pending, setPending] = useState(false)
  // Separate from `pending` so saving a profile change never puts the login
  // button into a loading state, or vice versa.
  const [profileSaving, setProfileSaving] = useState(false)
  // Set when signup succeeds but Supabase requires email confirmation before a
  // session exists — otherwise the user just sees the form clear with no clue.
  const [notice, setNotice] = useState(null)
  // True from landing on a reset link until the new password is saved (or the
  // user backs out). See ARRIVED_ON_RECOVERY above for why it seeds from the URL.
  const [recovering, setRecovering] = useState(ARRIVED_ON_RECOVERY)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) setError(friendlyError(sessionError))
        setSession(data?.session ?? null)
      })
      .catch((err) => {
        if (active) setError(friendlyError(err, 'Couldn’t restore your session.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Keeps other tabs, token refreshes and sign-outs in sync.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      // Fires when Supabase parses a recovery link. Only ever latches the flag
      // on: clearing it is `updatePassword`'s job, and SIGNED_IN lands straight
      // after this event with the recovery session, which would otherwise
      // switch the reset form off before it rendered.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const signIn = useCallback(async (email, password, remember = true) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      // Set before the call: the session write that follows reads this to pick
      // localStorage (remembered) or sessionStorage (this tab only).
      setRememberMe(remember)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t log you in.'))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  const signUp = useCallback(async (email, password, name = '') => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      // A fresh account is always remembered — nobody signs up intending to be
      // logged out the moment they close the tab.
      setRememberMe(true)

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Lands in auth.users.raw_user_meta_data and comes back on every
        // session as user.user_metadata — no profiles table needed for a
        // single string.
        options: { data: { full_name: name.trim() } },
      })
      if (signUpError) throw signUpError

      // No session back means "confirm your email" is switched on in the
      // project's auth settings. That's a success, not a failure.
      if (!data.session) {
        setNotice(`Almost there — we sent a confirmation link to ${email.trim()}. Click it, then log in.`)
      }
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t create your account.'))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  /**
   * Send a reset link.
   *
   * `redirectTo` has to be an absolute URL that the Supabase project lists
   * under Authentication → URL Configuration, or the link in the mail silently
   * falls back to the Site URL. `origin` rather than `href`: the app is one
   * page, and carrying the current `#food` fragment along would collide with
   * the `#access_token=…` one Supabase appends.
   *
   * The confirmation deliberately doesn't say whether the address had an
   * account. Supabase returns success either way — that's what stops this form
   * being used to test which emails are registered — so the copy has to match,
   * or the wording leaks exactly what the API declined to.
   */
  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const address = email.trim()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: window.location.origin,
      })
      if (resetError) throw resetError

      setNotice(`If ${address} has an account, a reset link is on its way. It expires in an hour.`)
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t send the reset link.'))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  /**
   * Set a new password, using the session the reset link established.
   *
   * Clearing `recovering` last is what hands the user on to the app proper —
   * they are, at this point, legitimately signed in.
   */
  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setRecovering(false)
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t change your password.'))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  /**
   * Back out of a reset without setting a new password.
   *
   * Signs out on the way, because the recovery link left a real session behind:
   * leaving it up would mean abandoning the reset dropped you into the app
   * anyway, which is the exact thing `recovering` exists to prevent.
   */
  const cancelRecovery = useCallback(async () => {
    setRecovering(false)
    setError(null)
    setNotice(null)
    if (isSupabaseConfigured) await supabase.auth.signOut()
  }, [])

  /**
   * Change the display name.
   *
   * Writes to the same `user_metadata.full_name` that signup sets, so there's
   * one source of truth for what to call someone. Supabase emits USER_UPDATED,
   * but the session is also patched directly here so the new name is on screen
   * before the event lands.
   */
  const updateName = useCallback(async (fullName) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }

    const trimmed = fullName.trim()
    if (!trimmed) {
      setError('Your name can’t be empty.')
      return false
    }

    setProfileSaving(true)
    setError(null)
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      })
      if (updateError) throw updateError

      setSession((prev) => (prev && data?.user ? { ...prev, user: data.user } : prev))
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t save your name.'))
      return false
    } finally {
      setProfileSaving(false)
    }
  }, [])

  /**
   * Change the avatar.
   *
   * Same bag as the name — one id string in `user_metadata`, so the choice
   * rides along on every session and no table has to be read before the first
   * face can be drawn.
   */
  const updateAvatar = useCallback(async (avatarId) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }

    setProfileSaving(true)
    setError(null)
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_id: avatarId },
      })
      if (updateError) throw updateError

      setSession((prev) => (prev && data?.user ? { ...prev, user: data.user } : prev))
      return true
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t save your avatar.'))
      return false
    } finally {
      setProfileSaving(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t log you out.'))
    }
  }, [])

  return useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      pending,
      error,
      notice,
      recovering,
      rememberedByDefault: getRememberMe(),
      profileSaving,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      cancelRecovery,
      updateName,
      updateAvatar,
      clearMessages,
    }),
    [
      session,
      loading,
      pending,
      error,
      notice,
      recovering,
      profileSaving,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      cancelRecovery,
      updateName,
      updateAvatar,
      clearMessages,
    ]
  )
}
