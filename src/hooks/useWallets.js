import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { DEFAULT_WALLETS } from '../data/defaultCategories'

/**
 * Wallets — Cash / Bank / Card out of the box, plus anything the user adds.
 *
 * Seeding follows the same rule as useCategories: only on a confirmed-empty
 * fetch, only once per mount.
 */
export function useWallets(userId) {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const seeded = useRef(false)

  const fetchWallets = useCallback(async () => {
    if (!userId) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(friendlyError(null))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      if (data?.length) {
        setWallets(data)
        return
      }

      if (seeded.current) {
        setWallets([])
        return
      }
      seeded.current = true

      const { data: inserted, error: seedError } = await supabase
        .from('wallets')
        .insert(DEFAULT_WALLETS.map((name) => ({ user_id: userId, name })))
        .select()

      if (seedError) throw seedError
      setWallets(inserted ?? [])
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t load your wallets.'))
      setWallets([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const addWallet = useCallback(
    async (name) => {
      if (!userId || !isSupabaseConfigured) return null

      const trimmed = name.trim()
      if (!trimmed) return null

      const clash = wallets.find((w) => w.name.toLowerCase() === trimmed.toLowerCase())
      if (clash) return clash

      setError(null)
      try {
        const { data, error: insertError } = await supabase
          .from('wallets')
          .insert({ user_id: userId, name: trimmed })
          .select()
          .single()

        if (insertError) throw insertError
        setWallets((prev) => [...prev, data])
        return data
      } catch (err) {
        setError(friendlyError(err, 'Couldn’t add that wallet.'))
        return null
      }
    },
    [userId, wallets]
  )

  /** The wallet new transactions start on — "Cash" if it exists, else the first. */
  const defaultWallet = wallets.find((w) => w.name.toLowerCase() === 'cash') ?? wallets[0] ?? null

  return {
    wallets,
    defaultWallet,
    loading,
    error,
    addWallet,
    refresh: fetchWallets,
    dismissError: useCallback(() => setError(null), []),
  }
}
