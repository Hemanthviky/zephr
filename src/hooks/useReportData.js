import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { REPORT_KINDS } from '../utils/reportBuilders'

/**
 * The rows a report covers, fetched on demand.
 *
 * Separate from the modules' own hooks on purpose: those are scoped to the day
 * or month on screen and cache it, while a report is a one-off question about
 * an arbitrary span ("last year, please"). Sharing one hook would mean either
 * the screen refetching every time someone opened the report sheet, or the
 * report inheriting a window it didn't ask for.
 *
 * Nothing is fetched until `enabled` — the panel is mounted alongside every
 * module and would otherwise pull a year of history on page load.
 */
export function useReportData(kind, userId, range, enabled) {
  const [rows, setRows] = useState([])
  const [extras, setExtras] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // A slow "everything" must not land on top of a later "today".
  const requestRef = useRef(0)

  const { from, to } = range

  const fetchRows = useCallback(async () => {
    if (!enabled || !userId || !from || !to) return
    if (!isSupabaseConfigured) {
      setError(friendlyError(null))
      return
    }

    const config = REPORT_KINDS[kind]
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from(config.table)
        .select('*')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)

      for (const { column } of config.order) query = query.order(column, { ascending: true })

      const [{ data, error: fetchError }, extraData] = await Promise.all([
        query,
        fetchExtras(config.needs, userId),
      ])

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return

      setRows(data ?? [])
      setExtras(extraData)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t pull the rows for this report.'))
      setRows([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [enabled, kind, userId, from, to])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  return { rows, extras, loading, error, refresh: fetchRows }
}

/**
 * The lookup tables a report needs to print names instead of uuids.
 *
 * Only Money has any, and they're small enough to refetch each time rather than
 * reach into another module's hook and inherit its loading state.
 */
async function fetchExtras(needs, userId) {
  if (!needs?.length) return {}

  const results = await Promise.all(
    needs.map((table) =>
      supabase.from(table).select('id, name').eq('user_id', userId)
    )
  )

  return Object.fromEntries(needs.map((table, index) => [table, results[index].data ?? []]))
}
