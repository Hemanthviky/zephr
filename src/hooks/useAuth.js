import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'

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

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
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

  const signUp = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return false
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
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
      signIn,
      signUp,
      signOut,
      clearMessages,
    }),
    [session, loading, pending, error, notice, signIn, signUp, signOut, clearMessages]
  )
}
