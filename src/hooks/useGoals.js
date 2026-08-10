import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'

/** Mirrors the column defaults in supabase/schema.sql. */
export const DEFAULT_GOALS = { calories: 2000, protein: 100, carbs: 250, fat: 65 }

/**
 * The user's daily targets.
 *
 * schema.sql seeds a goals row on signup, but we never assume it's there — a
 * project set up before that trigger existed, or a row deleted by hand, should
 * degrade to defaults rather than a blank screen. `upsert` makes the write
 * idempotent either way.
 */
export function useGoals(userId) {
  const [goals, setGoals] = useState(DEFAULT_GOALS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(friendlyError(null))
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('goals')
          .select('calories, protein, carbs, fat')
          .eq('user_id', userId)
          .maybeSingle() // no row is a normal state, not an error

        if (fetchError) throw fetchError
        if (!active) return
        setGoals(data ?? DEFAULT_GOALS)
      } catch (err) {
        if (!active) return
        setError(friendlyError(err, 'Couldn’t load your goals — showing defaults.'))
        setGoals(DEFAULT_GOALS)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [userId])

  const saveGoals = useCallback(
    async (next) => {
      if (!userId) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const clean = {
        calories: clamp(next.calories, 500, 10000),
        protein: clamp(next.protein, 0, 1000),
        carbs: clamp(next.carbs, 0, 1000),
        fat: clamp(next.fat, 0, 1000),
      }

      const previous = goals
      setGoals(clean)
      setSaving(true)
      setError(null)

      try {
        const { error: saveError } = await supabase
          .from('goals')
          .upsert({ user_id: userId, ...clean }, { onConflict: 'user_id' })

        if (saveError) throw saveError
        return true
      } catch (err) {
        setGoals(previous)
        setError(friendlyError(err, 'Couldn’t save your goals.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, goals]
  )

  return {
    goals,
    loading,
    saving,
    error,
    saveGoals,
    dismissError: useCallback(() => setError(null), []),
  }
}

function clamp(value, min, max) {
  const n = Math.round(Number(value) || 0)
  return Math.min(max, Math.max(min, n))
}
