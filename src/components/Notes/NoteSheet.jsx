import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Globe, Pin, Plus, Trash2, User, X } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import PasswordField from './PasswordField'
import { NOTE_COLORS, getColor, parseTags } from '../../utils/noteHelpers'

/**
 * The editor, for a paper note and for a saved login alike.
 *
 * One sheet rather than two because the shell is genuinely the same — a title,
 * a colour, tags, a pin, and a delete — and only the middle changes. Editing
 * reuses it whole, for the same reason the hospital sheet does: what you come
 * back to change is what you just typed.
 *
 * The kind switch only exists while creating. Turning a note into a login after
 * the fact would have to encrypt a body that has already been sitting on the
 * server in plaintext, and calling that "secured" would be a lie — so the sheet
 * doesn't offer it.
 *
 * No plaintext password ever reaches this component's props or its caller's
 * database row: it hands back a `secretPayload` and the module encrypts it.
 */
export default function NoteSheet({
  open,
  onClose,
  editing = null,
  initialKind = 'note',
  initialSecret = null,
  initialDraft = null,
  onSubmit,
  onDelete,
  saving = false,
  error,
}) {
  const [kind, setKind] = useState(initialKind)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState('cream')
  const [pinned, setPinned] = useState(false)
  const [tagText, setTagText] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [secretNote, setSecretNote] = useState('')

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const bodyRef = useRef(null)

  const isEdit = Boolean(editing)
  const isSecret = kind === 'secret'
  const paper = getColor(color)

  // Fill on the way in, and wipe on the way out. The wipe is not tidiness: a
  // decrypted password left in state after the sheet closes is a plaintext
  // password sitting in memory for as long as the tab is open.
  useEffect(() => {
    if (!open) {
      setPassword('')
      setUsername('')
      setUrl('')
      setSecretNote('')
      setConfirmingDelete(false)
      return
    }

    if (editing) {
      setKind(editing.kind)
      setTitle(editing.title ?? '')
      setBody(editing.kind === 'secret' ? '' : (editing.body ?? ''))
      setColor(editing.color ?? 'cream')
      setPinned(Boolean(editing.pinned))
      setTagText((editing.tags ?? []).join(', '))
      setUsername(initialSecret?.username ?? '')
      setPassword(initialSecret?.password ?? '')
      setUrl(initialSecret?.url ?? '')
      setSecretNote(initialSecret?.note ?? '')
      return
    }

    // A draft arrives when quick capture hands off to "More" — whatever was
    // already typed comes with it, or the handoff would be a punishment for
    // wanting a title.
    setKind(initialKind)
    setTitle('')
    setBody(initialDraft?.body ?? '')
    setColor(initialDraft?.color ?? 'cream')
    setPinned(Boolean(initialDraft?.pinned))
    setTagText('')
    setUsername('')
    setPassword('')
    setUrl('')
    setSecretNote('')
  }, [open, editing, initialKind, initialSecret, initialDraft])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  // The body grows with what's in it — a note is however long it is, and a
  // fixed six-line box that scrolls internally inside a sheet that also scrolls
  // is two scrollbars fighting over one gesture. Layout effect so the height is
  // right in the frame the sheet opens, not one after.
  useLayoutEffect(() => {
    const field = bodyRef.current
    if (!field || isSecret) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 420)}px`
  }, [body, open, isSecret])

  const tags = parseTags(tagText)
  const hasContent = isSecret
    ? Boolean(password.trim() || username.trim())
    : Boolean(title.trim() || body.trim())
  const canSave = hasContent && !saving

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSave) return

    const ok = await onSubmit({
      kind,
      title: title.trim().slice(0, 120),
      body: isSecret ? null : body.trim() || null,
      color,
      pinned,
      tags,
      secretPayload: isSecret
        ? {
            username: username.trim(),
            password,
            url: url.trim(),
            note: secretNote.trim(),
          }
        : null,
    })

    if (ok) onClose()
  }

  async function handleDelete() {
    const ok = await onDelete(editing.id)
    if (ok) onClose()
    else setConfirmingDelete(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Edit note' : isSecret ? 'Save a login' : 'Write a note'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="sheet max-w-[540px]"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            {/* The chosen paper colour, as a band across the head of the sheet.
                It's the only preview of the card you're making, and it's worth
                more here than a swatch outline down in the picker. */}
            <span
              className="absolute inset-x-0 top-0 h-1.5 rounded-t-[2rem]"
              style={{ background: paper.tape }}
              aria-hidden="true"
            />

            <header className="flex items-center gap-3 px-5 pb-3 pt-4">
              <Icon3D name={isSecret ? 'lockkey' : 'memo'} size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-extrabold tracking-tight">
                  {isEdit ? (isSecret ? 'Edit this login' : 'Edit this note') : isSecret ? 'New login' : 'New note'}
                </h2>
                <p className="truncate text-xs font-bold text-ink-400">
                  {isSecret ? 'Encrypted here, before it’s saved' : 'Plain text, on your board'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPinned((on) => !on)}
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin' : 'Pin to the top'}
                title={pinned ? 'Unpin' : 'Pin to the top'}
                className={[
                  'tactile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                  pinned
                    ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                    : 'border-transparent text-ink-300 hover:bg-cream-200 hover:text-ink-900',
                ].join(' ')}
              >
                <Pin
                  className="h-4 w-4"
                  strokeWidth={2.75}
                  fill={pinned ? 'currentColor' : 'none'}
                />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {!isEdit && (
                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1.5">
                  {[
                    { id: 'note', label: 'Note', icon: 'memo' },
                    { id: 'secret', label: 'Password', icon: 'lockkey' },
                  ].map((option) => {
                    const active = kind === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setKind(option.id)}
                        aria-pressed={active}
                        className={[
                          'tactile flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 font-display text-sm font-extrabold transition-colors',
                          active
                            ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                            : 'border-transparent text-ink-400 hover:bg-cream-50',
                        ].join(' ')}
                      >
                        <Icon3D name={option.icon} size={20} />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="note-title" className="label-caps mb-2 block">
                  {isSecret ? 'What is it for' : 'Title'}
                  {!isSecret && (
                    <span className="normal-case tracking-normal text-ink-300"> · optional</span>
                  )}
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  autoFocus={!isEdit && !isSecret}
                  placeholder={isSecret ? 'e.g. Bank · Netflix · Wi-Fi' : 'Give it a name'}
                  autoComplete="off"
                  className="min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 font-display text-base font-extrabold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                />
                {isSecret && (
                  <p className="mt-1.5 text-[0.7rem] font-semibold text-ink-400">
                    The title is the one thing not encrypted — it’s the label on the outside.
                  </p>
                )}
              </div>

              {isSecret ? (
                <>
                  <div className="mb-4">
                    <label htmlFor="note-username" className="label-caps mb-2 block">
                      Username or email
                    </label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-4 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-ink-300"
                        strokeWidth={2.75}
                        aria-hidden="true"
                      />
                      <input
                        id="note-username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        maxLength={200}
                        placeholder="you@example.com"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 pl-11 pr-4 text-base font-bold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <PasswordField value={password} onChange={setPassword} autoFocus={!isEdit} />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="note-url" className="label-caps mb-2 block">
                      Website{' '}
                      <span className="normal-case tracking-normal text-ink-300">· optional</span>
                    </label>
                    <div className="relative">
                      <Globe
                        className="pointer-events-none absolute left-4 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-ink-300"
                        strokeWidth={2.75}
                        aria-hidden="true"
                      />
                      <input
                        id="note-url"
                        type="text"
                        inputMode="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        maxLength={400}
                        placeholder="bank.example.com"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 pl-11 pr-4 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="note-secretnote" className="label-caps mb-2 block">
                      Anything else{' '}
                      <span className="normal-case tracking-normal text-ink-300">· encrypted too</span>
                    </label>
                    <textarea
                      id="note-secretnote"
                      value={secretNote}
                      onChange={(event) => setSecretNote(event.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Recovery codes, security answers, the PIN…"
                      className="w-full resize-none rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 p-4 text-base font-semibold leading-relaxed text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                    />
                  </div>
                </>
              ) : (
                <div className="mb-5">
                  <label htmlFor="note-body" className="label-caps mb-2 block">
                    Note
                  </label>
                  <textarea
                    id="note-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={20_000}
                    rows={5}
                    placeholder="Write it down before it’s gone…"
                    className="w-full resize-none overflow-y-auto rounded-2xl border-[2.5px] border-ink-900/15 p-4 text-base font-semibold leading-relaxed text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                    style={{ background: paper.paper }}
                  />
                  <p className="mt-1.5 text-right text-[0.7rem] font-semibold text-ink-300">
                    {body.length.toLocaleString()} / 20,000
                  </p>
                </div>
              )}

              {/* ── Paper ─────────────────────────────────────────────────── */}
              <div className="mb-5">
                <p className="label-caps mb-2">Paper</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_COLORS.map((option) => {
                    const active = color === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setColor(option.id)}
                        aria-pressed={active}
                        aria-label={option.label}
                        title={option.label}
                        className={[
                          'tactile relative h-11 w-11 overflow-hidden rounded-xl border-2 transition-colors',
                          active ? 'border-ink-900 shadow-press-sm' : 'border-ink-900/15',
                        ].join(' ')}
                        style={{ background: option.paper }}
                      >
                        <span
                          className="absolute inset-x-0 top-0 h-2.5"
                          style={{ background: option.tape }}
                          aria-hidden="true"
                        />
                        {active && (
                          <Check
                            className="absolute inset-0 m-auto h-4 w-4 text-ink-900"
                            strokeWidth={3.5}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="note-tags" className="label-caps mb-2 block">
                  Tags{' '}
                  <span className="normal-case tracking-normal text-ink-300">
                    · comma separated
                  </span>
                </label>
                <input
                  id="note-tags"
                  type="text"
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  placeholder="work, ideas, bills"
                  autoComplete="off"
                  autoCapitalize="off"
                  className="min-h-[52px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                />
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-pill border-2 border-ink-900/15 bg-cream-200 px-2.5 py-1 text-[0.7rem] font-extrabold text-ink-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe"
            >
              {error && (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-2.5 text-sm font-semibold text-coral-600"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                  <span>{error}</span>
                </div>
              )}

              {/* Delete sits beside save rather than in a menu, and confirms in
                  place — the same two-tap the food log and the chart use. */}
              <div className="flex gap-2">
                {isEdit && !confirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="Delete this note"
                    className="tactile flex min-h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[1.25rem] border-[3px] border-ink-900 bg-cream-50 text-ink-400 shadow-press transition-colors hover:bg-coral-100 hover:text-coral-600"
                  >
                    <Trash2 className="h-5 w-5" strokeWidth={2.75} />
                  </button>
                )}

                {confirmingDelete ? (
                  <div className="flex flex-1 items-center gap-2 rounded-[1.25rem] border-[3px] border-coral-500 bg-coral-100 px-3 py-2">
                    <p className="min-w-0 flex-1 font-display text-sm font-extrabold leading-tight text-coral-600">
                      Take it off the board?
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="tactile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
                      aria-label="Keep it"
                    >
                      <X className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="tactile flex h-11 shrink-0 items-center gap-1 rounded-xl border-2 border-ink-900 bg-coral-500 px-3 font-display text-sm font-extrabold text-cream-50 shadow-press-coral"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                      Delete
                    </button>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    icon={isEdit ? Check : Plus}
                    loading={saving}
                    disabled={!canSave}
                    className="flex-1"
                  >
                    {saving
                      ? isSecret
                        ? 'Encrypting…'
                        : 'Saving…'
                      : !hasContent
                        ? isSecret
                          ? 'Add a password'
                          : 'Write something first'
                        : isEdit
                          ? 'Save changes'
                          : isSecret
                            ? 'Lock it away'
                            : 'Pin it up'}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
