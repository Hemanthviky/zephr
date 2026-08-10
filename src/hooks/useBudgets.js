import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'

/**
 * One month's budgets: the overall cap, and the per-category split under it.
 *
 * The categories come back as a plain `{ [categoryId]: amount }` map — that's
 * how every consumer wants it (lookup by category while rendering a list), and
 * it keeps "no budget set" as a simple missing key rather than a row with
 * amount 0. `total` is the single overall figure, 0 when none is set.
 *
 * Both live in one hook because they're one decision made on one screen and
 * saved by one button. Splitting them would mean two loading flags, two error
 * banners, and a panel that can half-save.
 */
export function useBudgets(userId, month) {
  const [budgets, setBudgets] = useState({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const requestRef = useRef(0)

  const fetchBudgets = useCallback(async () => {
    if (!userId || !month) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(friendlyError(null))
      return
    }

    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      // In parallel: the two halves are independent, and the panel can't show
      // either of them until it has both.
      const [perCategory, overall] = await Promise.all([
        supabase
          .from('budgets')
          .select('category_id, amount')
          .eq('user_id', userId)
          .eq('month', month),
        // maybeSingle, not single: no overall cap is the normal state, not a
        // failed lookup, and `single` would report it as an error.
        supabase
          .from('month_budgets')
          .select('amount')
          .eq('user_id', userId)
          .eq('month', month)
          .maybeSingle(),
      ])

      if (perCategory.error) throw perCategory.error

      // The overall cap arrived after the category budgets did, so a project
      // running the older schema has the `budgets` table but not this one.
      // Read past that: the month still loads and simply has no total, which
      // is exactly the state it was in before the feature existed. Saving one
      // still reports the real error, with instructions.
      const missingTable = isMissingTable(overall.error)
      if (overall.error && !missingTable) throw overall.error
      if (missingTable && import.meta.env.DEV) {
        console.warn(
          '[Zephr] No `month_budgets` table — overall monthly budgets are off ' +
            'until supabase/schema.sql is re-run.'
        )
      }

      if (requestId !== requestRef.current) return

      setBudgets(
        Object.fromEntries((perCategory.data ?? []).map((row) => [row.category_id, Number(row.amount)]))
      )
      setTotal(missingTable ? 0 : Number(overall.data?.amount) || 0)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load your budgets.'))
      setBudgets({})
      setTotal(0)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  /**
   * Save the whole month at once from the settings panel — the overall cap and
   * every category in one go.
   *
   * Anything set to 0 or blank is deleted rather than stored, on both halves:
   * a zero budget and no budget are different claims, and the summary card
   * treats them differently. Clearing the total is how you go back to letting
   * the categories add themselves up.
   */
  const saveBudgets = useCallback(
    async ({ categories = {}, total: nextTotal = 0 } = {}) => {
      if (!userId || !month) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const cleaned = {}
      const removals = []

      for (const [categoryId, raw] of Object.entries(categories)) {
        const amount = toAmount(raw)
        if (amount > 0) cleaned[categoryId] = amount
        else if (budgets[categoryId] !== undefined) removals.push(categoryId)
      }

      const cleanedTotal = toAmount(nextTotal)

      const previous = budgets
      const previousTotal = total
      setBudgets(cleaned)
      setTotal(cleanedTotal)
      setSaving(true)
      setError(null)

      try {
        const rows = Object.entries(cleaned).map(([category_id, amount]) => ({
          user_id: userId,
          category_id,
          month,
          amount,
        }))

        if (rows.length) {
          const { error: upsertError } = await supabase
            .from('budgets')
            .upsert(rows, { onConflict: 'user_id,category_id,month' })
          if (upsertError) throw upsertError
        }

        if (removals.length) {
          const { error: deleteError } = await supabase
            .from('budgets')
            .delete()
            .eq('user_id', userId)
            .eq('month', month)
            .in('category_id', removals)
          if (deleteError) throw deleteError
        }

        if (cleanedTotal > 0) {
          const { error: totalError } = await supabase
            .from('month_budgets')
            .upsert({ user_id: userId, month, amount: cleanedTotal }, { onConflict: 'user_id,month' })
          if (totalError) throw totalError
        } else if (previousTotal > 0) {
          const { error: clearError } = await supabase
            .from('month_budgets')
            .delete()
            .eq('user_id', userId)
            .eq('month', month)
          if (clearError) throw clearError
        }

        return true
      } catch (err) {
        setBudgets(previous)
        setTotal(previousTotal)
        setError(friendlyError(err, 'Couldn’t save your budgets.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, month, budgets, total]
  )

  return {
    budgets,
    total,
    loading,
    saving,
    error,
    saveBudgets,
    refresh: fetchBudgets,
    dismissError: useCallback(() => setError(null), []),
  }
}

/** Money, never negative, never more precise than paise. */
function toAmount(raw) {
  return Math.max(0, Math.round((Number(raw) || 0) * 100) / 100)
}

/**
 * "That table isn't in this database", however it's phrased — PostgREST answers
 * with PGRST205 off its schema cache, Postgres itself with 42P01.
 */
function isMissingTable(error) {
  if (!error) return false
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return (
    text.includes('pgrst205') ||
    text.includes('42p01') ||
    text.includes('could not find the table')
  )
}
