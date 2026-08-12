import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import {
  createVault,
  isVaultSupported,
  unlockVault,
  PBKDF2_ITERATIONS,
} from '../utils/vaultCrypto'

/**
 * How long the vault stays open with nothing happening.
 *
 * Ten minutes is the compromise. Shorter and it re-prompts in the middle of
 * copying three passwords into a form; longer and an unlocked laptop left on a
 * desk is an unlocked vault. Any pointer or key event anywhere in the app
 * resets it, so it only ever fires on genuine inactivity.
 */
const IDLE_LOCK_MS = 10 * 60 * 1000

/**
 * The master key, its lifetime, and the one row on the server that describes it.
 *
 * The key lives in a ref and nowhere else. Not in state (a re-render is not a
 * reason to hand a CryptoKey to React's devtools), not in localStorage, not in
 * sessionStorage — persisting it anywhere would mean anything that can read
 * that store can read every password, which is the exact thing the encryption
 * is for. The cost is real and deliberate: a page reload re-prompts.
 *
 * `status` is what the UI branches on:
 *   'loading'  — we don't know yet whether this user has a vault
 *   'absent'   — no vault; offer to create one
 *   'locked'   — a vault exists and we don't hold its key
 *   'unlocked' — we hold the key, for now
 */
export function useVault(userId) {
  const [vault, setVault] = useState(null)
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const keyRef = useRef(null)
  const idleTimer = useRef(null)
  // Bumped whenever the key changes, purely so consumers that decrypt in an
  // effect re-run — the key itself lives in a ref and can't be a dependency.
  const [keyEpoch, setKeyEpoch] = useState(0)

  const lock = useCallback(() => {
    keyRef.current = null
    clearTimeout(idleTimer.current)
    setKeyEpoch((n) => n + 1)
    setStatus((current) => (current === 'unlocked' ? 'locked' : current))
  }, [])

  /* ── The vault row ─────────────────────────────────────────────────────── */

  const fetchVault = useCallback(async () => {
    if (!userId) return
    if (!isSupabaseConfigured) {
      setStatus('absent')
      setError(friendlyError(null))
      return
    }

    setStatus('loading')
    setError(null)

    try {
      // maybeSingle, not single: "this user has never set up a vault" is the
      // expected first-run state, not an error to surface.
      const { data, error: fetchError } = await supabase
        .from('vault')
        .select('salt, verifier, iterations, hint')
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchError) throw fetchError

      setVault(data ?? null)
      setStatus(data ? 'locked' : 'absent')
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t check whether you have a vault.'))
      setStatus('absent')
    }
  }, [userId])

  useEffect(() => {
    fetchVault()
  }, [fetchVault])

  // Switching accounts must never carry a key across. The effect above already
  // refetches; this makes sure the old key is gone before the new row lands.
  useEffect(() => lock, [userId, lock])

  /* ── Idle lock ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (status !== 'unlocked') return undefined

    const reset = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(lock, IDLE_LOCK_MS)
    }

    reset()
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const event of events) window.addEventListener(event, reset, { passive: true })

    return () => {
      clearTimeout(idleTimer.current)
      for (const event of events) window.removeEventListener(event, reset)
    }
  }, [status, lock])

  /* ── Setting one up, opening it, changing the passphrase ───────────────── */

  const setup = useCallback(
    async (passphrase, hint) => {
      if (!userId || !isVaultSupported) return false
      setBusy(true)
      setError(null)

      try {
        const material = await createVault(passphrase, PBKDF2_ITERATIONS)
        const row = {
          user_id: userId,
          salt: material.salt,
          verifier: material.verifier,
          iterations: material.iterations,
          hint: hint?.trim() ? hint.trim().slice(0, 120) : null,
        }

        // insert, not upsert: overwriting an existing vault row would replace
        // the salt and orphan every secret already encrypted under the old key.
        const { error: insertError } = await supabase.from('vault').insert(row)
        if (insertError) throw insertError

        keyRef.current = material.key
        setVault({
          salt: material.salt,
          verifier: material.verifier,
          iterations: material.iterations,
          hint: row.hint,
        })
        setKeyEpoch((n) => n + 1)
        setStatus('unlocked')
        return true
      } catch (err) {
        setError(friendlyError(err, 'Couldn’t create your vault.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [userId]
  )

  const unlock = useCallback(
    async (passphrase) => {
      if (!vault || !isVaultSupported) return false
      setBusy(true)
      setError(null)

      try {
        const key = await unlockVault(passphrase, vault)
        if (!key) {
          setError('That’s not the passphrase. Nothing was unlocked.')
          return false
        }

        keyRef.current = key
        setKeyEpoch((n) => n + 1)
        setStatus('unlocked')
        return true
      } catch {
        setError('Couldn’t unlock the vault. Try that passphrase again.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [vault]
  )

  /**
   * Change the master passphrase.
   *
   * Every secret has to be re-encrypted, because the key is derived from the
   * passphrase and a new passphrase is a new key. `reencrypt` is handed in by
   * useNotes — this hook has no business knowing how notes are stored, and
   * useNotes has no business knowing how keys are derived.
   *
   * Order matters and is the interesting part: the notes are rewritten under
   * the new key *first*, and only then does the vault row learn the new salt.
   * The reverse order has a window where a crash leaves a vault whose verifier
   * accepts a passphrase that decrypts none of its contents — the one failure
   * here that loses data rather than just wasting a minute.
   */
  const changePassphrase = useCallback(
    async (current, next, hint, reencrypt) => {
      if (!vault || !userId || !isVaultSupported) return false
      setBusy(true)
      setError(null)

      try {
        const oldKey = await unlockVault(current, vault)
        if (!oldKey) {
          setError('That’s not your current passphrase.')
          return false
        }

        const material = await createVault(next, PBKDF2_ITERATIONS)

        const rewritten = await reencrypt(oldKey, material.key)
        if (!rewritten) {
          setError('Couldn’t re-encrypt your saved logins, so nothing was changed.')
          return false
        }

        const { error: updateError } = await supabase
          .from('vault')
          .update({
            salt: material.salt,
            verifier: material.verifier,
            iterations: material.iterations,
            hint: hint?.trim() ? hint.trim().slice(0, 120) : null,
          })
          .eq('user_id', userId)

        if (updateError) throw updateError

        keyRef.current = material.key
        setVault({
          salt: material.salt,
          verifier: material.verifier,
          iterations: material.iterations,
          hint: hint?.trim() ? hint.trim().slice(0, 120) : null,
        })
        setKeyEpoch((n) => n + 1)
        setStatus('unlocked')
        return true
      } catch (err) {
        setError(friendlyError(err, 'Couldn’t change the passphrase.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [vault, userId]
  )

  return {
    status,
    hint: vault?.hint ?? null,
    supported: isVaultSupported,
    busy,
    error,
    keyEpoch,
    /** Read at call time only — never stored, never put in state. */
    getKey: useCallback(() => keyRef.current, []),
    setup,
    unlock,
    lock,
    changePassphrase,
    dismissError: useCallback(() => setError(null), []),
  }
}
