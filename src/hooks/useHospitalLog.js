import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { addDays } from '../utils/dateHelpers'
import { sortByTime, sumMl } from '../utils/hospitalMath'

/**
 * How many days of chart come back in one round trip.
 *
 * The day on screen needs one day. The medicine field needs the *names* someone
 * has been giving, and re-typing "Pantoprazole 40" every morning is exactly the
 * kind of thing that makes a tracker get abandoned by Wednesday — so a month of
 * history rides along and becomes the suggestion list. Manual-entry volumes are
 * tiny; this is cheaper than a second query.
 */
const HISTORY_DAYS = 30

/**
 * One day's ward chart for one user, plus the recent history behind it.
 *
 * Writes are optimistic with rollback, mirroring hooks/useEntries.js and
 * hooks/useTransactions.js — the row appears on the chart the instant you save
 * it, and rolls back out if the database refuses it.
 */
export function useHospitalLog(userId, date) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Same guard as the other day-scoped hooks: a slow fetch for the 3rd must
  // never overwrite the 4th after the user has already navigated.
  const requestRef = useRef(0)

  const fetchLogs = useCallback(async () => {
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
        .from('hospital_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', addDays(date, -HISTORY_DAYS))
        .lte('date', date)
        .order('date', { ascending: true })
        .order('at', { ascending: true })

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return
      setHistory(data ?? [])
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load this day’s chart.'))
      setHistory([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, date])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const rows = useMemo(
    () => sortByTime(history.filter((row) => row.date === date)),
    [history, date]
  )

  const drinks = useMemo(() => rows.filter((row) => row.kind === 'drink'), [rows])
  const meds = useMemo(() => rows.filter((row) => row.kind === 'med'), [rows])

  const totals = useMemo(
    () => ({
      ml: sumMl(drinks),
      drinks: drinks.length,
      doses: meds.length,
      lastDrinkAt: drinks.length ? drinks[drinks.length - 1].at : null,
      lastMedAt: meds.length ? meds[meds.length - 1].at : null,
    }),
    [drinks, meds]
  )

  /**
   * Medicines this user has logged before, most recently used first.
   *
   * Keyed by name so "Paracetamol 650" typed once is offered forever, and the
   * form it was given in comes back with it — picking a suggestion fills the
   * whole row, not just the name.
   */
  const medSuggestions = useMemo(() => {
    const seen = new Map()
    for (const row of history) {
      if (row.kind !== 'med') continue
      const key = row.name.trim().toLowerCase()
      // Later rows overwrite earlier ones: the most recent dose is the one
      // worth suggesting, since that's what the prescription says now.
      seen.set(key, { name: row.name, item: row.item, unit: row.unit, amount: Number(row.amount) })
    }
    return [...seen.values()].reverse().slice(0, 12)
  }, [history])

  const addLog = useCallback(
    async (draft) => {
      if (!userId) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const tempId = `optimistic-${Date.now()}`
      const payload = { ...draft, user_id: userId }
      const optimistic = { ...payload, id: tempId, created_at: new Date().toISOString() }

      setHistory((prev) => sortByTime([...prev, optimistic]))
      setSaving(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('hospital_logs')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError
        setHistory((prev) => sortByTime(prev.map((row) => (row.id === tempId ? data : row))))
        return true
      } catch (err) {
        setHistory((prev) => prev.filter((row) => row.id !== tempId))
        setError(friendlyError(err, 'Couldn’t save that to the chart. It wasn’t logged.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId]
  )

  const updateLog = useCallback(
    async (id, patch) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = history
      setHistory((prev) => sortByTime(prev.map((row) => (row.id === id ? { ...row, ...patch } : row))))
      setSaving(true)
      setError(null)

      try {
        const { data, error: updateError } = await supabase
          .from('hospital_logs')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()

        if (updateError) throw updateError
        setHistory((prev) => sortByTime(prev.map((row) => (row.id === id ? data : row))))
        return true
      } catch (err) {
        setHistory(snapshot)
        setError(friendlyError(err, 'Couldn’t update that chart entry.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, history]
  )

  const deleteLog = useCallback(
    async (id) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = history
      setHistory((prev) => prev.filter((row) => row.id !== id))
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('hospital_logs')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        return true
      } catch (err) {
        setHistory(snapshot) // it's still in the database, so put it back
        setError(friendlyError(err, 'Couldn’t delete that chart entry.'))
        return false
      }
    },
    [userId, history]
  )

  return {
    rows,
    drinks,
    meds,
    totals,
    medSuggestions,
    loading,
    saving,
    error,
    addLog,
    updateLog,
    deleteLog,
    refresh: fetchLogs,
    dismissError: useCallback(() => setError(null), []),
  }
}

/** Bounds on the daily fluid target, matching the input's own min/max. */
const TARGET_MIN = 200
const TARGET_MAX = 8000
export const DEFAULT_FLUID_TARGET = 2000

/**
 * The daily fluid target.
 *
 * Deliberately *not* in the goals table: a fluid restriction is a doctor's
 * number for this admission, not a nutrition goal, and it changes on the ward
 * round rather than in a settings panel. It lives in localStorage, keyed by
 * user, so two people sharing a laptop don't inherit each other's limit — and
 * so nothing in the shared goals plumbing has to learn about hospitals.
 */
export function useFluidTarget(userId) {
  const key = `zephr.fluid-target.${userId ?? 'anon'}`

  const [target, setTarget] = useState(() => readTarget(key))

  // Switching accounts without a reload has to re-read: the state above only
  // runs its initialiser once.
  useEffect(() => {
    setTarget(readTarget(key))
  }, [key])

  const saveTarget = useCallback(
    (next) => {
      const clean = Math.min(TARGET_MAX, Math.max(TARGET_MIN, Math.round(Number(next) || 0)))
      setTarget(clean)
      try {
        window.localStorage.setItem(key, String(clean))
      } catch {
        // Private mode, or storage blocked. The target still holds for this
        // session, which is the part that matters on screen.
      }
    },
    [key]
  )

  return { target, saveTarget }
}

function readTarget(key) {
  try {
    const stored = Number(window.localStorage.getItem(key))
    if (Number.isFinite(stored) && stored >= TARGET_MIN && stored <= TARGET_MAX) return stored
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_FLUID_TARGET
}
