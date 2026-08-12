import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, KeyRound, Lock, Plus, Search, Unlock, X } from 'lucide-react'
import NoteBoard from './NoteBoard'
import NoteSheet from './NoteSheet'
import QuickCapture from './QuickCapture'
import VaultGate from './VaultGate'
import Avatar from '../shared/Avatar'
import Icon3D from '../shared/Icon3D'
import { useNotes } from '../../hooks/useNotes'
import { useVault } from '../../hooks/useVault'
import { displayName, firstName } from '../../hooks/useAuth'
import { collectTags, matchesQuery, sortNotes } from '../../utils/noteHelpers'
import { encryptJSON } from '../../utils/vaultCrypto'

/**
 * The Notes module — a pinboard, with a locked drawer in it.
 *
 * It deliberately breaks the shape the other three modules share. Food, Money
 * and Hospital are all "a day (or a month), summarised on the left, itemised on
 * the right", because all three are ledgers and a ledger has a period. Notes
 * has no period — nothing here belongs to a Tuesday — so a date navigator and a
 * summary card would be furniture with nothing to hold. What replaces them is
 * the thing a board actually needs: a way in at the top (quick capture), a way
 * to find things (search and filters), and then the wall.
 *
 * The two kinds of card on that wall are the interesting part. A note is paper:
 * plaintext, coloured, tilted, taped up. A login is a card in a sleeve:
 * encrypted in this browser under a master passphrase, straight, foil-edged,
 * with the password behind a guilloche redaction bar. They share a board, a
 * search box and a pin, and nothing else — which is what lets one tab be both
 * "the shopping list" and "the bank login" without either feeling misfiled.
 *
 * This component owns the crypto orchestration, and only this component: the
 * key comes from useVault, the ciphertext goes to useNotes, and neither of them
 * knows about the other.
 */
export default function Notes({ user, onOpenProfile }) {
  const {
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
    refresh,
    dismissError,
  } = useNotes(user.id)

  // Destructured rather than kept as one object: `getKey`, `lock` and friends
  // are stable useCallbacks, and depending on the whole hook return (a fresh
  // literal every render) would rebuild every callback below on every keystroke
  // in the search box.
  const {
    status: vaultStatus,
    hint: vaultHint,
    supported: vaultSupported,
    busy: vaultBusy,
    error: vaultError,
    getKey,
    setup: setupVault,
    unlock: unlockVault,
    lock: lockVault,
    changePassphrase,
    dismissError: dismissVaultError,
  } = useVault(user.id)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeTag, setActiveTag] = useState(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKind, setSheetKind] = useState('note')
  const [editing, setEditing] = useState(null)
  const [editingSecret, setEditingSecret] = useState(null)
  const [draft, setDraft] = useState(null)

  const [gateOpen, setGateOpen] = useState(false)
  const [gateMode, setGateMode] = useState('auto')
  // What to do once the vault opens — set when an action needed a key it
  // didn't have, replayed by the effect below when the key arrives.
  const [pending, setPending] = useState(null)
  const [problem, setProblem] = useState(null)

  const unlocked = vaultStatus === 'unlocked'

  const openGate = useCallback(
    (mode = 'auto') => {
      dismissVaultError()
      setGateMode(mode)
      setGateOpen(true)
    },
    [dismissVaultError]
  )

  /* ── What's on the wall right now ───────────────────────────────────────── */

  const tags = useMemo(() => collectTags(notes), [notes])

  const visible = useMemo(() => {
    const filtered = notes.filter((note) => {
      if (filter === 'pinned' && !note.pinned) return false
      if (filter === 'note' && note.kind !== 'note') return false
      if (filter === 'secret' && note.kind !== 'secret') return false
      if (activeTag && !(note.tags ?? []).includes(activeTag)) return false
      return matchesQuery(note, query)
    })
    return sortNotes(filtered)
  }, [notes, filter, activeTag, query])

  // A tag that was only on the note you just deleted would otherwise leave the
  // board filtered to nothing, with the chip that's doing it no longer drawn.
  useEffect(() => {
    if (activeTag && !tags.some((entry) => entry.tag === activeTag)) setActiveTag(null)
  }, [tags, activeTag])

  /* ── The vault gate, and what was waiting on it ─────────────────────────── */

  const requireVault = useCallback(
    (action) => {
      if (vaultStatus === 'unlocked') return true
      setPending(action)
      openGate('auto')
      return false
    },
    [vaultStatus, openGate]
  )

  const openEdit = useCallback(
    async (note) => {
      setProblem(null)

      if (note.kind === 'secret') {
        if (!requireVault({ type: 'edit', note })) return
        const payload = await readSecret(getKey(), note)
        if (!payload) {
          // Opening the editor on a blob we couldn't read would show empty
          // fields, and saving them would overwrite the real thing with them.
          setProblem('That login won’t open with the current passphrase, so it can’t be edited.')
          return
        }
        setEditingSecret(payload)
      } else {
        setEditingSecret(null)
      }

      dismissError()
      setDraft(null)
      setEditing(note)
      setSheetKind(note.kind)
      setSheetOpen(true)
    },
    [requireVault, readSecret, getKey, dismissError]
  )

  const openCreate = useCallback(
    (kind = 'note', prefill = null) => {
      if (kind === 'secret' && !requireVault({ type: 'create' })) return
      dismissError()
      setProblem(null)
      setEditing(null)
      setEditingSecret(null)
      setDraft(prefill)
      setSheetKind(kind)
      setSheetOpen(true)
    },
    [requireVault, dismissError]
  )

  // Replay whatever was blocked, once the key exists.
  useEffect(() => {
    if (vaultStatus !== 'unlocked' || !pending) return
    const action = pending
    setPending(null)
    if (action.type === 'create') openCreate('secret')
    else if (action.type === 'edit') openEdit(action.note)
  }, [vaultStatus, pending, openCreate, openEdit])

  /* ── Writes ─────────────────────────────────────────────────────────────── */

  /**
   * Turn what the sheet handed back into a row.
   *
   * The encryption happens here and nowhere else. A secret row leaves with
   * `body: null` and a ciphertext `secret` — the database also refuses the
   * other combination, but it should never have to.
   */
  async function buildRow({ kind, title, body, color, pinned, tags: noteTags, secretPayload }) {
    if (kind !== 'secret') {
      return { kind, title, body, secret: null, color, pinned, tags: noteTags }
    }

    const key = getKey()
    if (!key) {
      requireVault({ type: 'create' })
      return null
    }

    return {
      kind,
      title,
      body: null,
      secret: await encryptJSON(key, secretPayload ?? {}),
      color,
      pinned,
      tags: noteTags,
    }
  }

  async function handleSubmit(payload) {
    const row = await buildRow(payload)
    if (!row) return false
    return editing ? updateNote(editing.id, row) : addNote(row)
  }

  const quickSave = useCallback(
    async (payload) =>
      addNote({
        kind: 'note',
        title: payload.title,
        body: payload.body,
        secret: null,
        color: payload.color,
        pinned: payload.pinned,
        tags: payload.tags,
      }),
    [addNote]
  )

  const reveal = useCallback((note) => readSecret(getKey(), note), [readSecret, getKey])

  /** The passphrase change, with useNotes doing the re-encryption half. */
  const handleChangePassphrase = useCallback(
    (currentPass, nextPass, nextHint) =>
      changePassphrase(currentPass, nextPass, nextHint, reencryptSecrets),
    [changePassphrase, reencryptSecrets]
  )

  const secretCount = useMemo(
    () => notes.filter((note) => note.kind === 'secret').length,
    [notes]
  )

  const FILTERS = [
    { id: 'all', label: 'All', count: notes.length },
    { id: 'pinned', label: 'Pinned', count: notes.filter((note) => note.pinned).length },
    { id: 'note', label: 'Notes', count: notes.length - secretCount },
    { id: 'secret', label: 'Vault', count: secretCount },
  ]

  return (
    <div className="min-h-[100dvh] lg:pl-[248px]">
      <div className="mx-auto w-full max-w-[540px] px-page pb-dock pt-safe md:max-w-[900px] lg:max-w-[1120px] xl:max-w-[1320px] 2xl:max-w-[1500px]">
        <header className="flex items-center justify-between gap-3 py-4 md:py-5 lg:py-7">
          <div className="flex items-center gap-2 md:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm">
              <Icon3D name="pushpin" size={19} />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-[0.18em]">
              Board
            </span>
          </div>

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
              The board, {firstName(user)}.
            </h1>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink-400">
              Everything you’d otherwise forget — and the passwords, locked.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <VaultPill
              status={vaultStatus}
              count={secretCount}
              onLock={lockVault}
              onOpen={() => openGate('auto')}
              onChangePassphrase={() => openGate('change')}
            />

            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label="Your profile"
                className="tactile rounded-2xl lg:hidden"
              >
                <Avatar name={displayName(user)} size={44} />
              </button>
            )}
          </div>
        </header>

        <div className="mb-5">
          <QuickCapture
            onQuickSave={quickSave}
            onExpand={(prefill) => openCreate('note', prefill)}
            onNewSecret={() => openCreate('secret')}
            saving={saving}
          />
        </div>

        {/* Sticky, because the board below it is the one screen in Zephr that
            can run to several viewports, and scrolling back to the top to
            change a filter is the thing that makes people stop using filters. */}
        <div className="sticky top-2 z-30 mb-5">
          <div className="rounded-[1.4rem] border-2 border-ink-900/10 bg-cream-50/95 p-2 shadow-card backdrop-blur-md">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-ink-300"
                strokeWidth={2.75}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the board…"
                aria-label="Search notes"
                className="min-h-[46px] w-full rounded-2xl border-2 border-ink-900/10 bg-cream-100 pl-11 pr-10 text-[0.95rem] font-bold text-ink-900 transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              )}
            </div>

            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {FILTERS.map((option) => {
                const active = filter === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    aria-pressed={active}
                    className={[
                      'tactile inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors',
                      active
                        ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                        : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/40',
                    ].join(' ')}
                  >
                    {option.id === 'secret' && (
                      <Lock className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    )}
                    {option.label}
                    <span className={`nums ${active ? 'text-ink-700' : 'text-ink-300'}`}>
                      {option.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {tags.length > 0 && (
              <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
                {tags.map(({ tag, count }) => {
                  const active = activeTag === tag
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(active ? null : tag)}
                      aria-pressed={active}
                      className={[
                        'inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-pill border-2 px-2.5 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] transition-colors',
                        active
                          ? 'border-ink-900 bg-ink-900 text-cream-50'
                          : 'border-ink-900/12 bg-cream-100 text-ink-400 hover:border-ink-900/30',
                      ].join(' ')}
                    >
                      #{tag}
                      <span className="nums opacity-60">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {problem && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-coral-600" strokeWidth={2.75} />
              <p className="min-w-0 flex-1 text-sm font-semibold text-coral-600">{problem}</p>
              <button
                type="button"
                onClick={() => setProblem(null)}
                aria-label="Dismiss"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-coral-600 transition-colors hover:bg-coral-300/50"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <NoteBoard
          notes={visible}
          loading={loading}
          error={sheetOpen ? null : error}
          query={query}
          filter={filter}
          vaultUnlocked={unlocked}
          onOpen={openEdit}
          onTogglePin={togglePin}
          onDelete={deleteNote}
          onReveal={reveal}
          onRequestUnlock={() => openGate('auto')}
          onRetry={refresh}
          onCreate={openCreate}
        />
      </div>

      {/* Bottom dock, offset by the tab bar — same as Hospital. Quick capture
          lives at the top of the page, which is the wrong end of a board you've
          scrolled through, so both ways in are also down here. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-40 md:hidden">
        <div className="h-16 bg-gradient-to-t from-cream-100 via-cream-100/90 to-transparent short:h-8" />
        <div className="bg-cream-100 pb-3 short:pb-2">
          <div className="mx-auto grid w-full max-w-[540px] grid-cols-[1fr_auto] gap-2 px-page">
            <button
              type="button"
              onClick={() => openCreate('note')}
              className="tactile pointer-events-auto flex min-h-[62px] items-center justify-center gap-2 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-base font-extrabold shadow-press hover:bg-lime-300 short:min-h-[52px] short:text-sm"
            >
              <Plus className="h-5 w-5" strokeWidth={3.25} aria-hidden="true" />
              New note
              <Icon3D name="memo" size={22} />
            </button>
            <button
              type="button"
              onClick={() => openCreate('secret')}
              aria-label="Save a password"
              className="tactile pointer-events-auto flex min-h-[62px] w-[66px] items-center justify-center rounded-[1.25rem] border-[3px] border-ink-900 bg-cream-50 shadow-press hover:bg-cream-100 short:min-h-[52px]"
            >
              <KeyRound className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <NoteSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditing(null)
          setEditingSecret(null)
          setDraft(null)
        }}
        editing={editing}
        initialKind={sheetKind}
        initialSecret={editingSecret}
        initialDraft={draft}
        onSubmit={handleSubmit}
        onDelete={deleteNote}
        saving={saving}
        error={sheetOpen ? error : null}
      />

      <VaultGate
        open={gateOpen}
        onClose={() => {
          setGateOpen(false)
          setGateMode('auto')
          setPending(null)
        }}
        status={vaultStatus}
        mode={gateMode}
        hint={vaultHint}
        supported={vaultSupported}
        busy={vaultBusy}
        error={vaultError}
        onSetup={setupVault}
        onUnlock={unlockVault}
        onChange={handleChangePassphrase}
        onDismissError={dismissVaultError}
      />
    </div>
  )
}

/**
 * The vault's state, always visible, always one tap from changing.
 *
 * A password manager that doesn't tell you whether it's currently open is a
 * password manager you don't trust, so this sits in the header at every size.
 *
 * Locked, it's a plain button: tapping it is unambiguously "let me in". Open,
 * it becomes a menu, because there are now two things you might want and one of
 * them ("lock it, someone's coming") must not be one tap away from the other
 * ("change the passphrase", which rewrites every row you own).
 */
function VaultPill({ status, count, onLock, onOpen, onChangePassphrase }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const shellRef = useRef(null)

  const open = status === 'unlocked'

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (event) => {
      if (!shellRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Re-locking while the menu is up would leave it hanging over a button that
  // no longer opens it.
  useEffect(() => {
    if (!open) setMenuOpen(false)
  }, [open])

  if (status === 'loading') {
    return <span className="skeleton h-11 w-11 rounded-xl sm:w-[104px]" aria-hidden="true" />
  }

  const label = open
    ? 'Vault options'
    : status === 'absent'
      ? 'Set up the vault'
      : 'Unlock the vault'

  return (
    <div ref={shellRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setMenuOpen((on) => !on) : onOpen())}
        aria-label={label}
        title={label}
        aria-expanded={open ? menuOpen : undefined}
        aria-haspopup={open ? 'menu' : undefined}
        className={[
          'tactile flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-ink-900 px-2.5 font-display text-xs font-extrabold shadow-press-sm transition-colors sm:px-3',
          open ? 'bg-lime-400 hover:bg-lime-300' : 'bg-cream-50 hover:bg-cream-100',
        ].join(' ')}
      >
        {open ? (
          <Unlock className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
        ) : (
          <Lock className="h-4 w-4 text-ink-500" strokeWidth={3} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{open ? 'Open' : 'Locked'}</span>
        {count > 0 && <span className="nums text-ink-400">{count}</span>}
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[228px] overflow-hidden rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-lift"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onLock()
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-cream-200"
            >
              <Lock className="h-4 w-4 shrink-0" strokeWidth={2.75} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-display text-sm font-extrabold leading-tight">
                  Lock it now
                </span>
                <span className="block text-[0.68rem] font-semibold text-ink-400">
                  Also happens after 10 idle minutes
                </span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onChangePassphrase()
              }}
              className="flex w-full items-center gap-2.5 border-t-2 border-ink-900/10 px-3.5 py-3 text-left transition-colors hover:bg-cream-200"
            >
              <KeyRound className="h-4 w-4 shrink-0" strokeWidth={2.75} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-display text-sm font-extrabold leading-tight">
                  Change passphrase
                </span>
                <span className="block text-[0.68rem] font-semibold text-ink-400">
                  Re-encrypts all {count} saved {count === 1 ? 'login' : 'logins'}
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
