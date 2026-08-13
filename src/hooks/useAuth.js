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
 * Session state + the three auth actions the app needs.
 *
 * `loading` is true only for the very first "do we already have a session?"
 * check on boot — App.jsx uses it to hold the splash instead of flashing the
 * login screen at a user who is already signed in.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  // Separate from `pending` so saving a profile change never puts the login
  // button into a loading state, or vice versa.
  const [profileSaving, setProfileSaving] = useState(false)
  // Set when signup succeeds but Supabase requires email confirmation before a
  // session exists — otherwise the user just sees the form clear with no clue.
  const [notice, setNotice] = useState(null)

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
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
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
      rememberedByDefault: getRememberMe(),
      profileSaving,
      signIn,
      signUp,
      signOut,
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
      profileSaving,
      signIn,
      signUp,
      signOut,
      updateName,
      updateAvatar,
      clearMessages,
    ]
  )
}
