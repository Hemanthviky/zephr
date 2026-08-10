import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'

/**
 * Per-category monthly budgets for one month.
 *
 * Exposed as a plain `{ [categoryId]: amount }` map — that's how every consumer
 * wants it (lookup by category while rendering a list), and it keeps "no budget
 * set" as a simple missing key rather than a row with amount 0.
 */
export function useBudgets(userId, month) {
  const [budgets, setBudgets] = useState({})
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
      const { data, error: fetchError } = await supabase
        .from('budgets')
        .select('category_id, amount')
        .eq('user_id', userId)
        .eq('month', month)

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return

      setBudgets(Object.fromEntries((data ?? []).map((row) => [row.category_id, Number(row.amount)])))
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load your budgets.'))
      setBudgets({})
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  /**
   * Save the whole month at once from the settings panel.
   * Anything set to 0 or blank is deleted rather than stored — a zero budget
   * and no budget are different claims, and the summary card treats them
   * differently.
   */
  const saveBudgets = useCallback(
    async (next) => {
      if (!userId || !month) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const cleaned = {}
      const removals = []

      for (const [categoryId, raw] of Object.entries(next)) {
        const amount = Math.max(0, Math.round((Number(raw) || 0) * 100) / 100)
        if (amount > 0) cleaned[categoryId] = amount
        else if (budgets[categoryId] !== undefined) removals.push(categoryId)
      }

      const previous = budgets
      setBudgets(cleaned)
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

        return true
      } catch (err) {
        setBudgets(previous)
        setError(friendlyError(err, 'Couldn’t save your budgets.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, month, budgets]
  )

  return {
    budgets,
    loading,
    saving,
    error,
    saveBudgets,
    refresh: fetchBudgets,
    dismissError: useCallback(() => setError(null), []),
  }
}
