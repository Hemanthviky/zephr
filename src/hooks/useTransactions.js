import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { addMonths, monthBounds, monthOf } from '../utils/expenseMath'

/** How many months of history the trend chart shows, including the current one. */
export const TREND_MONTHS = 6

/**
 * Transactions for the selected month — plus the five months before it, in the
 * same round trip, because the trend chart needs them and manual-entry volumes
 * are tiny. One query feeds both the list and the chart.
 *
 * Writes are optimistic with rollback, mirroring hooks/useEntries.js.
 */
export function useTransactions(userId, month) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Same guard as useEntries: a slow fetch for July must not overwrite August.
  const requestRef = useRef(0)

  const fetchTransactions = useCallback(async () => {
    if (!userId || !month) return
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(friendlyError(null))
      return
    }

    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)

    const windowStart = monthBounds(addMonths(month, -(TREND_MONTHS - 1))).start
    const windowEnd = monthBounds(month).end

    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', windowStart)
        .lte('date', windowEnd)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return
      setHistory(data ?? [])
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load this month’s spending.'))
      setHistory([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, month])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  /** Newest first — the row you just added should be the row you can see. */
  const transactions = useMemo(
    () => history.filter((tx) => monthOf(tx.date) === month),
    [history, month]
  )

  const addTransaction = useCallback(
    async (draft) => {
      if (!userId) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const tempId = `optimistic-${Date.now()}`
      const payload = { ...draft, user_id: userId }
      const optimistic = { ...payload, id: tempId, created_at: new Date().toISOString() }

      setHistory((prev) => sortByDate([optimistic, ...prev]))
      setSaving(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('transactions')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError
        setHistory((prev) => sortByDate(prev.map((tx) => (tx.id === tempId ? data : tx))))
        return true
      } catch (err) {
        setHistory((prev) => prev.filter((tx) => tx.id !== tempId))
        setError(friendlyError(err, 'Couldn’t save that transaction. It wasn’t logged.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId]
  )

  const updateTransaction = useCallback(
    async (id, patch) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = history
      setHistory((prev) => sortByDate(prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))))
      setSaving(true)
      setError(null)

      try {
        const { data, error: updateError } = await supabase
          .from('transactions')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()

        if (updateError) throw updateError
        setHistory((prev) => sortByDate(prev.map((tx) => (tx.id === id ? data : tx))))
        return true
      } catch (err) {
        setHistory(snapshot)
        setError(friendlyError(err, 'Couldn’t update that transaction.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, history]
  )

  const deleteTransaction = useCallback(
    async (id) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = history
      setHistory((prev) => prev.filter((tx) => tx.id !== id))
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        return true
      } catch (err) {
        setHistory(snapshot)
        setError(friendlyError(err, 'Couldn’t delete that transaction.'))
        return false
      }
    },
    [userId, history]
  )

  return {
    transactions,
    history,
    loading,
    saving,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refresh: fetchTransactions,
    dismissError: useCallback(() => setError(null), []),
  }
}

/** Newest date first, then newest entry first within a day. */
function sortByDate(rows) {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
}
