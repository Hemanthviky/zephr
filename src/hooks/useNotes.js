import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured, friendlyError } from '../lib/supabaseClient'
import { decryptJSON, encryptJSON } from '../utils/vaultCrypto'
import { sortNotes } from '../utils/noteHelpers'

/**
 * Every note this user has, and the writes that change them.
 *
 * Optimistic with rollback, the same as useEntries / useTransactions /
 * useHospitalLog — the card lands on the board as you release the button and
 * comes back off if the database refuses it. What's different here is that
 * notes aren't scoped to a day or a month, so there's one fetch for the whole
 * board and the filtering happens in the component. A board that paginated
 * would need a "load more" button, which is the wrong shape for a pinboard.
 *
 * This hook never sees a plaintext password. Secrets arrive already encrypted
 * from the caller, which holds the key; the two exceptions are `readSecret` and
 * `reencryptSecrets`, which take a key as an argument, use it, and forget it.
 */
export function useNotes(userId) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const requestRef = useRef(0)
  // Writes read the current board to build their rollback snapshot. Through a
  // ref rather than the state value, so add/update/delete don't take `notes` as
  // a dependency and get rebuilt — and re-memoised down the tree — on every
  // keystroke that touches a note.
  const notesRef = useRef(notes)
  notesRef.current = notes

  const fetchNotes = useCallback(async () => {
    if (!userId) return
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
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })

      if (fetchError) throw fetchError
      if (requestId !== requestRef.current) return
      setNotes(data ?? [])
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(friendlyError(err, 'Couldn’t load your board.'))
      setNotes([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const addNote = useCallback(
    async (draft) => {
      if (!userId) return false
      if (!isSupabaseConfigured) {
        setError(friendlyError(null))
        return false
      }

      const tempId = `optimistic-${Date.now()}`
      const payload = { ...draft, user_id: userId }
      const now = new Date().toISOString()
      const optimistic = { ...payload, id: tempId, created_at: now, updated_at: now }

      setNotes((prev) => sortNotes([optimistic, ...prev]))
      setSaving(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('notes')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError
        setNotes((prev) => sortNotes(prev.map((note) => (note.id === tempId ? data : note))))
        return true
      } catch (err) {
        setNotes((prev) => prev.filter((note) => note.id !== tempId))
        setError(friendlyError(err, 'Couldn’t pin that to the board. It wasn’t saved.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId]
  )

  const updateNote = useCallback(
    async (id, patch) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = notesRef.current
      // updated_at is stamped by a database trigger, but the board sorts by it,
      // so the optimistic copy carries a local guess. The real value replaces
      // it a moment later; without it a re-pinned note visibly jumps twice.
      const optimistic = { ...patch, updated_at: new Date().toISOString() }
      setNotes((prev) =>
        sortNotes(prev.map((note) => (note.id === id ? { ...note, ...optimistic } : note)))
      )
      setSaving(true)
      setError(null)

      try {
        const { data, error: updateError } = await supabase
          .from('notes')
          .update(patch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()

        if (updateError) throw updateError
        setNotes((prev) => sortNotes(prev.map((note) => (note.id === id ? data : note))))
        return true
      } catch (err) {
        setNotes(snapshot)
        setError(friendlyError(err, 'Couldn’t save that change.'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId]
  )

  const deleteNote = useCallback(
    async (id) => {
      if (!userId || !isSupabaseConfigured) return false

      const snapshot = notesRef.current
      setNotes((prev) => prev.filter((note) => note.id !== id))
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        return true
      } catch (err) {
        setNotes(snapshot) // still on the server, so put it back on the board
        setError(friendlyError(err, 'Couldn’t delete that note.'))
        return false
      }
    },
    [userId]
  )

  /** Pin/unpin — its own function because the card calls it on a single tap. */
  const togglePin = useCallback(
    (note) => updateNote(note.id, { pinned: !note.pinned }),
    [updateNote]
  )

  /**
   * Open one secret, with a key supplied by the caller.
   *
   * Returns null rather than throwing on a blob this key can't open. That
   * happens in exactly one situation worth handling — a note encrypted under a
   * previous passphrase that a failed re-encryption left behind — and the card
   * shows "can't open this one" instead of taking the board down.
   */
  const readSecret = useCallback(async (key, note) => {
    if (!key || !note?.secret) return null
    try {
      return await decryptJSON(key, note.secret)
    } catch {
      return null
    }
  }, [])

  /**
   * Re-encrypt every secret from one key to another, for a passphrase change.
   *
   * All-or-nothing by intent: it decrypts and re-encrypts the whole set in
   * memory first, and only writes once every row has come out cleanly. A
   * partial pass would leave half the board readable under the old passphrase
   * and half under the new one, with no way to tell which is which.
   *
   * The writes themselves aren't a transaction — PostgREST has no way to make
   * them one from here — so a network failure mid-loop can still leave a split
   * board. It's reported rather than swallowed, and because the vault row is
   * only updated after this returns true, the old passphrase still opens
   * whatever didn't get rewritten.
   */
  const reencryptSecrets = useCallback(
    async (oldKey, newKey) => {
      if (!userId || !isSupabaseConfigured) return false

      const secrets = notesRef.current.filter(
        (note) => note.kind === 'secret' && note.secret && !String(note.id).startsWith('optimistic-')
      )
      if (secrets.length === 0) return true

      try {
        const rewritten = []
        for (const note of secrets) {
          const payload = await decryptJSON(oldKey, note.secret)
          rewritten.push({ id: note.id, secret: await encryptJSON(newKey, payload) })
        }

        for (const row of rewritten) {
          const { error: updateError } = await supabase
            .from('notes')
            .update({ secret: row.secret })
            .eq('id', row.id)
            .eq('user_id', userId)
          if (updateError) throw updateError
        }

        setNotes((prev) => {
          const bySecret = new Map(rewritten.map((row) => [row.id, row.secret]))
          return prev.map((note) =>
            bySecret.has(note.id) ? { ...note, secret: bySecret.get(note.id) } : note
          )
        })
        return true
      } catch (err) {
        setError(friendlyError(err, 'Couldn’t re-encrypt your saved logins.'))
        return false
      }
    },
    [userId]
  )

  return {
    notes,
    loading,
    saving,
    error,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    readSecret,
    reencryptSecrets,
    refresh: fetchNotes,
    dismissError: useCallback(() => setError(null), []),
  }
}
