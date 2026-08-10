import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'

/** Mirrors the column defaults in supabase/schema.sql. */
export const DEFAULT_GOALS = {
  calories: 2000,
  protein: 100,
  carbs: 250,
  fat: 65,
  // Optional body stats behind the calorie calculator. Null means "not told us
  // yet", which is a normal, permanent state — hand-typed goals never need them.
  height_cm: null,
  weight_kg: null,
  age: null,
  sex: null,
  activity: null,
  aim: null,
}

const BODY_FIELDS = ['height_cm', 'weight_kg', 'age', 'sex', 'activity', 'aim']

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
          .select('calories, protein, carbs, fat, height_cm, weight_kg, age, sex, activity, aim')
          .eq('user_id', userId)
          .maybeSingle() // no row is a normal state, not an error

        if (fetchError) throw fetchError
        if (!active) return
        setGoals(data ? { ...DEFAULT_GOALS, ...data } : DEFAULT_GOALS)
      } catch (err) {
        if (!active) return
        // A missing body column means schema.sql hasn't been re-run since the
        // calculator shipped. Say so precisely — "couldn't load your goals" would
        // send someone hunting in entirely the wrong place.
        const missingColumn = /column .* does not exist/i.test(err?.message ?? '')
        setError(
          missingColumn
            ? 'Your database is missing the body-stats columns — re-run supabase/schema.sql, then reload.'
            : friendlyError(err, 'Couldn’t load your goals — showing defaults.')
        )
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
        // Body stats pass through as-is, normalised to null when blank — the
        // column checks reject '' and 0 alike, and "not set" is a real answer.
        ...Object.fromEntries(
          BODY_FIELDS.map((field) => [field, blankToNull(next[field])])
        ),
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

/** '' / undefined / NaN → null; numeric strings → numbers; ids stay strings. */
function blankToNull(value) {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'string' && !/^-?\d*\.?\d+$/.test(value.trim())) return value
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function clamp(value, min, max) {
  const n = Math.round(Number(value) || 0)
  return Math.min(max, Math.max(min, n))
}
