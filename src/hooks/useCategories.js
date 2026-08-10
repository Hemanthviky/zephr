import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { DEFAULT_CATEGORIES } from '../data/defaultCategories'

/**
 * Spending categories, seeded on first use.
 *
 * The seed runs exactly once per mount and only when the fetch comes back
 * genuinely empty — a failed fetch must never be mistaken for "new user", or
 * we'd duplicate the default nine every time the network hiccups.
 */
export function useCategories(userId) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const seeded = useRef(false)

  const fetchCategories = useCallback(async () => {
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
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      if (data?.length) {
        setCategories(data)
        return
      }

      if (seeded.current) {
        setCategories([])
        return
      }
      seeded.current = true

      const seedRows = DEFAULT_CATEGORIES.map((category) => ({
        ...category,
        user_id: userId,
        is_default: true,
      }))

      const { data: inserted, error: seedError } = await supabase
        .from('categories')
        .insert(seedRows)
        .select()

      if (seedError) throw seedError
      setCategories(inserted ?? [])
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t load your categories.'))
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const addCategory = useCallback(
    async ({ name, icon, color }) => {
      if (!userId || !isSupabaseConfigured) return null

      const trimmed = name.trim()
      if (!trimmed) return null

      // Categories are per-user and free-form, so the only duplicate check that
      // matters is a case-insensitive name clash with one they already have.
      const clash = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
      if (clash) return clash

      setError(null)
      try {
        const { data, error: insertError } = await supabase
          .from('categories')
          .insert({ user_id: userId, name: trimmed, icon, color, is_default: false })
          .select()
          .single()

        if (insertError) throw insertError
        setCategories((prev) => [...prev, data])
        return data
      } catch (err) {
        setError(friendlyError(err, 'Couldn’t add that category.'))
        return null
      }
    },
    [userId, categories]
  )

  const deleteCategory = useCallback(
    async (id) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = categories
      setCategories((prev) => prev.filter((c) => c.id !== id))
      setError(null)

      try {
        // Transactions keep their history — the FK is `on delete set null`, so
        // they fall back to "Uncategorised" rather than vanishing.
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        return true
      } catch (err) {
        setCategories(snapshot)
        setError(friendlyError(err, 'Couldn’t delete that category.'))
        return false
      }
    },
    [userId, categories]
  )

  return {
    categories,
    loading,
    error,
    addCategory,
    deleteCategory,
    refresh: fetchCategories,
    dismissError: useCallback(() => setError(null), []),
  }
}
