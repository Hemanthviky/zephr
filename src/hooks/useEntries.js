import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { sumEntries } from '../utils/nutritionMath'

/**
 * One day's food log for one user.
 *
 * Writes are optimistic: adding or deleting updates local state first and rolls
 * back if Supabase rejects it. Logging food is the app's core loop and a 300ms
 * network round-trip before the number moves makes it feel broken.
 */
export function useEntries(userId, date) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Guards against a slow fetch for 3 Aug landing after the user has already
  // swiped to 4 Aug and overwriting the newer day's entries.
  const requestRef = useRef(0)

  const fetchEntries = useCallback(async () => {
    if (!userId || !date) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(friendlyError(null))
      return
    }

    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return // a newer day won the race
      setEntries(data ?? [])
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load this day’s food.'))
      setEntries([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, date])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  /**
   * @param {object} entry  { name, grams, calories, protein, carbs, fat, fiber, sugar, sodium }
   * @returns {Promise<boolean>} whether it persisted
   */
  const addEntry = useCallback(
    async (entry) => {
      if (!userId) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const tempId = `optimistic-${Date.now()}`
      const payload = { ...entry, user_id: userId, date }
      const optimistic = { ...payload, id: tempId, created_at: new Date().toISOString() }

      setEntries((prev) => [...prev, optimistic])
      setSaving(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('entries')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        // Swap the placeholder for the real row (real uuid, server timestamp).
        setEntries((prev) => prev.map((e) => (e.id === tempId ? data : e)))
        return true
      } catch (err) {
        setEntries((prev) => prev.filter((e) => e.id !== tempId))
        setError(friendlyError(err, 'Couldn’t save that food. It wasn’t logged.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, date]
  )

  const deleteEntry = useCallback(
    async (id) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = entries
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('entries')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        return true
      } catch (err) {
        setEntries(snapshot) // put it back — it's still in the database
        setError(friendlyError(err, 'Couldn’t delete that entry.'))
        return false
      }
    },
    [userId, entries]
  )

  const totals = useMemo(() => sumEntries(entries), [entries])

  return {
    entries,
    totals,
    loading,
    saving,
    error,
    addEntry,
    deleteEntry,
    refresh: fetchEntries,
    dismissError: useCallback(() => setError(null), []),
  }
}
