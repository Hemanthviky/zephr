import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  AlignLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Lock,
  Pin,
  Plus,
  Printer,
  Table,
  Trash2,
  Unlock,
  User,
  X,
} from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import PasswordField from './PasswordField'
import {
  MAX_SECRET_FIELDS,
  NOTE_COLORS,
  SECRET_FIELD_LABEL_MAX,
  SECRET_FIELD_VALUE_MAX,
  bodyToItems,
  getColor,
  hasChecklist,
  itemsToBody,
  normalizeSecretFields,
  parseTags,
} from '../../utils/noteHelpers'
import { downloadNote, unsupportedGlyphs } from '../../utils/noteExport'

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

/**
 * Row identity for the custom fields.
 *
 * They need a key that survives a reorder or a delete, and the label can't be
 * it — two blank rows would collide the moment you add a second one, and React
 * would carry the wrong text into the wrong input. A counter is enough: these
 * ids never leave the component and are never saved.
 */
let fieldSeq = 0
const nextFieldId = () => `field-${(fieldSeq += 1)}`

/** The same trick again, for checklist rows — two blank items would collide. */
let itemSeq = 0
const nextItemId = () => `item-${(itemSeq += 1)}`

/**
 * Size a textarea to its content.
 *
 * scrollHeight measures the content box while the box itself is sized
 * border-box, so the difference has to be added back or the last line is
 * clipped and a scrollbar appears on a field that was supposed to have grown
 * to fit. `limit` is the point past which it stops growing and starts
 * scrolling — the checklist rows pass none, because an item that has to
 * scroll is an item you can't read, which is the whole thing this fixes.
 */
function growToFit(field, limit = Infinity) {
  if (!field) return
  field.style.height = 'auto'
  const chrome = field.offsetHeight - field.clientHeight
  field.style.height = `${Math.min(field.scrollHeight + chrome, limit)}px`
}

/**
 * What the board asked for, mapped onto what this sheet actually is.
 *
 * Three doors — note, checklist, password — onto two kinds of row: a checklist
 * is a note, opened with the list editor showing. Keeping that translation in
 * one pair of functions is what stops 'checklist' leaking into `kind` and from
 * there into a database column that has never heard of it.
 */
const kindOf = (requested) => (requested === 'secret' ? 'secret' : 'note')
const modeOf = (requested) => (requested === 'checklist' ? 'list' : 'text')

const withRowIds = (rows, { atLeastOne = false } = {}) => {
  const withIds = (rows ?? []).map((row) => ({ ...row, id: nextItemId() }))
  if (atLeastOne && withIds.length === 0) {
    withIds.push({ id: nextItemId(), text: '', done: false })
  }
  return withIds
}

export default function NoteSheet({
  open,
  onClose,
  editing = null,
  initialKind = 'note',
  initialSecret = null,
  initialEncrypted = true,
  initialDraft = null,
  onSubmit,
  onDelete,
  saving = false,
  error,
  vaultReady = false,
  vaultExists = false,
  vaultSupported = true,
  onRequestVault,
  deferEscape = false,
}) {
  const [kind, setKind] = useState(kindOf(initialKind))
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  /**
   * How the note is being written: as prose, or as a list of tick boxes.
   *
   * Not a second kind of note — both save to the same `body` column, and a
   * checklist is only a body whose lines start with a box (see the helpers).
   * The mode is which editor is on screen, and switching it is a conversion
   * that round-trips: text in, boxes out, text back.
   */
  const [mode, setMode] = useState(modeOf(initialKind))
  const [items, setItems] = useState([])
  // Which row to put the cursor in — see focusField, same reasoning.
  const [focusItem, setFocusItem] = useState(null)
  const [color, setColor] = useState('cream')
  const [pinned, setPinned] = useState(false)
  const [tagText, setTagText] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [secretNote, setSecretNote] = useState('')
  const [fields, setFields] = useState([])
  // Whether this login gets the vault. Optional, per login — see the switch.
  const [encrypt, setEncrypt] = useState(false)
  // Which custom row to put the cursor in — set only by "Add a field", so a
  // re-render for any other reason doesn't yank focus out of what you're typing.
  const [focusField, setFocusField] = useState(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Purely so the button can say it worked — a file arriving in a folder you
  // can't see looks exactly like a button that did nothing.
  const [downloaded, setDownloaded] = useState(false)
  // Which format is being built, which only the PDF is ever slow enough to need.
  const [downloading, setDownloading] = useState(null)
  const bodyRef = useRef(null)

  /**
   * The vault's state, readable without depending on it.
   *
   * The fill-and-wipe effect below must run when the sheet opens and at no other
   * time. Taking `vaultExists` as a dependency would make turning the lock on
   * with no vault — which creates one, which flips that flag — re-run the reset
   * and wipe the login being typed. So the default reads through a ref.
   */
  const vaultRef = useRef({ vaultSupported, vaultExists })
  vaultRef.current = { vaultSupported, vaultExists }

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
      setFields([])
      setFocusField(null)
      setFocusItem(null)
      setConfirmingDelete(false)
      setDownloaded(false)
      return
    }

    if (editing) {
      setKind(editing.kind)
      setTitle(editing.title ?? '')
      setBody(editing.kind === 'secret' ? '' : (editing.body ?? ''))
      // Opened as what it already is: a note with boxes in it opens in the list
      // editor, everything else opens in the text one. Deriving it from the
      // body rather than storing it is the whole point of keeping one column.
      setMode(hasChecklist(editing.body) ? 'list' : 'text')
      setItems(withRowIds(bodyToItems(editing.body)))
      setColor(editing.color ?? 'cream')
      setPinned(Boolean(editing.pinned))
      setTagText((editing.tags ?? []).join(', '))
      setUsername(initialSecret?.username ?? '')
      setPassword(initialSecret?.password ?? '')
      setUrl(initialSecret?.url ?? '')
      setSecretNote(initialSecret?.note ?? '')
      setFields(
        normalizeSecretFields(initialSecret?.fields).map((field) => ({
          ...field,
          id: nextFieldId(),
        }))
      )
      setFocusField(null)
      // Whatever it was saved as, which is not necessarily what the default
      // would be — an unencrypted login must not silently become encrypted (or
      // the reverse) just because it was opened.
      setEncrypt(Boolean(initialEncrypted))
      return
    }

    // A draft arrives when quick capture hands off to "More" — whatever was
    // already typed comes with it, or the handoff would be a punishment for
    // wanting a title.
    setKind(kindOf(initialKind))
    setTitle('')
    setBody(initialDraft?.body ?? '')
    setMode(modeOf(initialKind))
    // A new list opens with one empty row already out, because "add the first
    // item" is a tap that has no reason to exist.
    setItems(
      modeOf(initialKind) === 'list'
        ? withRowIds(bodyToItems(initialDraft?.body), { atLeastOne: true })
        : []
    )
    setColor(initialDraft?.color ?? 'cream')
    setPinned(Boolean(initialDraft?.pinned))
    setTagText('')
    setUsername('')
    setPassword('')
    setUrl('')
    setSecretNote('')
    setFields([])
    setFocusField(null)
    // On by default for anyone who already has a vault — they've said what they
    // want. Off for someone who never set one up, because the alternative is
    // demanding a master passphrase from someone who only wanted to write the
    // Wi-Fi key down. Either way the switch is right there.
    setEncrypt(vaultRef.current.vaultSupported && vaultRef.current.vaultExists)
  }, [open, editing, initialKind, initialSecret, initialEncrypted, initialDraft])

  // "Saved" goes back to the download arrow on its own — it's a receipt, not a
  // state the note is in.
  useEffect(() => {
    if (!downloaded) return undefined
    const timer = setTimeout(() => setDownloaded(false), 2200)
    return () => clearTimeout(timer)
  }, [downloaded])

  useEffect(() => {
    if (!open) return undefined
    // While the passphrase gate is stacked on top, Escape belongs to it.
    const onKey = (event) => event.key === 'Escape' && !deferEscape && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose, deferEscape])

  /**
   * Put the cursor where the last edit said it should go.
   *
   * autoFocus can't do this job: it only fires when an input mounts, and half
   * the moves here — backspacing an empty row to join the one above — hand the
   * cursor to a row that's been on screen the whole time. The request is
   * cleared once it's honoured so a re-render for any other reason doesn't
   * yank focus back out of wherever it has since gone.
   */
  const itemRefs = useRef(new Map())
  useEffect(() => {
    if (!focusItem) return
    const field = itemRefs.current.get(focusItem)
    setFocusItem(null)
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [focusItem, items])

  // Every row, sized to what's in it. One pass over the whole list rather than
  // a handler on each row, because a paste can add several at once and a mode
  // switch replaces all of them.
  useLayoutEffect(() => {
    if (mode !== 'list' || !open) return
    itemRefs.current.forEach((field) => growToFit(field))
  }, [items, mode, open])

  // The body grows with what's in it — a note is however long it is, and a
  // fixed six-line box that scrolls internally inside a sheet that also scrolls
  // is two scrollbars fighting over one gesture. Layout effect so the height is
  // right in the frame the sheet opens, not one after.
  useLayoutEffect(() => {
    if (isSecret) return
    growToFit(bodyRef.current, 420)
  }, [body, open, isSecret])

  const tags = parseTags(tagText)
  // The saved shape, which is also what decides whether there's anything here:
  // a login that is nothing but a Wi-Fi key under a field called "Network key"
  // is a real login, so the empty rows have to be dropped before we ask.
  const secretFields = normalizeSecretFields(fields)
  // What the list editor would save. Computed here rather than at submit
  // because it's also the answer to "is there anything in this note yet".
  const listBody = itemsToBody(items)
  const noteBody = mode === 'list' ? listBody : body.trim()
  const ticked = items.filter((item) => item.done && item.text.trim()).length
  const hasContent = isSecret
    ? Boolean(password.trim() || username.trim() || secretFields.length > 0)
    : Boolean(title.trim() || noteBody)
  const canSave = hasContent && !saving

  /**
   * The lock, on or off.
   *
   * Turning it *on* asks for the passphrase now rather than at the save. The
   * gate stacks over this sheet, so nothing typed is disturbed, and it's the
   * honest moment to ask: the switch claims the login will be encrypted, and
   * without a key in memory that claim isn't true yet.
   */
  function toggleEncrypt() {
    if (encrypt) {
      setEncrypt(false)
      return
    }
    if (!vaultSupported) return
    setEncrypt(true)
    if (!vaultReady) onRequestVault?.()
  }

  function addField() {
    if (fields.length >= MAX_SECRET_FIELDS) return
    const id = nextFieldId()
    setFields((prev) => [...prev, { id, label: '', value: '', hidden: false }])
    setFocusField(id)
  }

  function patchField(id, patch) {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, ...patch } : field)))
  }

  function removeField(id) {
    setFields((prev) => prev.filter((field) => field.id !== id))
  }

  /* ── The checklist ────────────────────────────────────────────────────── */

  /**
   * Text ⟷ boxes, losing nothing in either direction.
   *
   * Every line of what's written becomes an item on the way in, and every item
   * becomes a line with its box still on it on the way out — so this is a
   * conversion rather than a flag, and flipping it twice gives back what you
   * started with. That's what makes it safe to offer on a note that already
   * has something in it, which is where most checklists actually come from.
   */
  function switchMode(next) {
    if (next === mode) return
    if (next === 'list') setItems(withRowIds(bodyToItems(body), { atLeastOne: true }))
    else setBody(itemsToBody(items))
    setFocusItem(null)
    setMode(next)
  }

  /** A new row, under the one you were in — or at the end when nothing said. */
  function addItem(afterId = null) {
    const row = { id: nextItemId(), text: '', done: false }
    const at = afterId ? items.findIndex((item) => item.id === afterId) : -1
    setItems(at < 0 ? [...items, row] : [...items.slice(0, at + 1), row, ...items.slice(at + 1)])
    setFocusItem(row.id)
  }

  function patchItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  /**
   * What was typed — or pasted — into one row.
   *
   * A row holds one line, because one line is what it saves as. So a paste
   * carrying newlines becomes a row each instead of one row with the breaks
   * quietly flattened out of it: pasting a list in from a message or a
   * shopping site is the fastest way there is to get one onto the board, and
   * it should land as a list.
   */
  function changeItem(item, value) {
    if (!value.includes('\n')) {
      patchItem(item.id, { text: value })
      return
    }

    const rows = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ id: nextItemId(), text, done: item.done }))
    // Nothing but whitespace pasted in: leave the row it landed in alone.
    if (rows.length === 0) return

    const at = items.findIndex((entry) => entry.id === item.id)
    setItems([...items.slice(0, at), ...rows, ...items.slice(at + 1)])
    setFocusItem(rows[rows.length - 1].id)
  }

  function removeItem(id, { focusPrevious = false } = {}) {
    const at = items.findIndex((item) => item.id === id)
    if (at < 0) return
    if (focusPrevious) setFocusItem(items[at - 1]?.id ?? null)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  /**
   * The two keys a list editor lives or dies by.
   *
   * Enter opens the next row instead of submitting the sheet — you write a
   * shopping list in one run of typing, and reaching for the mouse between
   * "milk" and "eggs" is the thing that stops people using it. Backspace on an
   * empty row deletes it and joins the one above, which is the behaviour every
   * other list editor has and whose absence makes one feel broken.
   */
  function handleItemKey(event, item) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addItem(item.id)
      return
    }
    if (event.key === 'Backspace' && !item.text && items.length > 1) {
      event.preventDefault()
      removeItem(item.id, { focusPrevious: true })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSave) return

    const ok = await onSubmit({
      kind,
      title: title.trim().slice(0, 120),
      body: isSecret ? null : noteBody || null,
      color,
      pinned,
      tags,
      secretPayload: isSecret
        ? {
            username: username.trim(),
            password,
            url: url.trim(),
            note: secretNote.trim(),
            fields: secretFields,
          }
        : null,
      encrypted: isSecret && encrypt,
    })

    if (ok) onClose()
  }

  /**
   * What a file of this note would contain, built from the live fields.
   *
   * Not from `editing`, so what lands in the file is what you're looking at —
   * including the line you typed thirty seconds ago and haven't saved yet.
   * Exporting the stored row instead would hand you a file that quietly
   * disagrees with the sheet it came out of.
   */
  const downloadable = {
    kind: 'note',
    title: title.trim(),
    body: noteBody,
    tags,
    pinned,
    color,
    updated_at: editing?.updated_at,
  }

  // Only the PDF cares. Memoised because it walks the whole note character by
  // character, and this component re-renders on every keystroke in it.
  const lostGlyphs = useMemo(
    () => (isSecret ? [] : unsupportedGlyphs({ title, body: noteBody })),
    [isSecret, title, noteBody]
  )

  /**
   * Save a copy, in the format the menu asked for.
   *
   * Never offered for a login: `downloadNote` refuses one anyway, and the button
   * isn't drawn.
   */
  async function handleDownload(format) {
    if (downloading) return
    setDownloading(format)
    try {
      await downloadNote(downloadable, format)
      setDownloaded(true)
    } catch (err) {
      // The PDF is the only path that can fail, and only by failing to fetch
      // jsPDF. Nothing to say in the footer that the two other formats sitting
      // in the same menu don't already answer.
      console.error('[Zephr] note download failed', err)
    } finally {
      setDownloading(null)
    }
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
              <Icon3D name={isSecret ? 'lockkey' : mode === 'list' ? 'clipboard' : 'memo'} size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-extrabold tracking-tight">
                  {isEdit
                    ? isSecret
                      ? 'Edit this login'
                      : mode === 'list'
                        ? 'Edit this list'
                        : 'Edit this note'
                    : isSecret
                      ? 'New login'
                      : mode === 'list'
                        ? 'New checklist'
                        : 'New note'}
                </h2>
                <p className="truncate text-xs font-bold text-ink-400">
                  {isSecret
                    ? encrypt
                      ? 'Encrypted here, before it’s saved'
                      : 'Saved without the lock'
                    : mode === 'list'
                      ? 'Tick boxes, on your board'
                      : 'Plain text, on your board'}
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
              {/* Three doors, two kinds of row: a checklist is a note that
                  opens with its boxes showing. The list gets its own door
                  rather than living behind a toggle inside the note editor
                  because "add a to-do" is a thing people arrive already
                  intending to do, and one tap is the whole feature. */}
              {!isEdit && (
                <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1.5">
                  {[
                    { id: 'note', label: 'Note', icon: 'memo' },
                    { id: 'checklist', label: 'List', icon: 'clipboard' },
                    { id: 'secret', label: 'Password', icon: 'lockkey' },
                  ].map((option) => {
                    const active =
                      option.id === 'secret' ? isSecret : !isSecret && mode === modeOf(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setKind(kindOf(option.id))
                          if (option.id !== 'secret') switchMode(modeOf(option.id))
                        }}
                        aria-pressed={active}
                        className={[
                          'tactile flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 px-1 font-display text-[0.8rem] font-extrabold transition-colors',
                          active
                            ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                            : 'border-transparent text-ink-400 hover:bg-cream-50',
                        ].join(' ')}
                      >
                        <Icon3D name={option.icon} size={19} />
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
                {isSecret && encrypt && (
                  <p className="mt-1.5 text-[0.7rem] font-semibold text-ink-400">
                    The title is the one thing not encrypted — it’s the label on the outside.
                  </p>
                )}
              </div>

              {isSecret ? (
                <>
                  {/* ── The lock ──────────────────────────────────────────
                      Optional, per login, and it has to be legible either way.
                      On, this is the vault: encrypted on this device, unreadable
                      to the server, unrecoverable if the passphrase goes. Off,
                      it's a labelled form with copy buttons and nothing more —
                      still useful, still worth having, but plain text on the
                      server, which the switch says in as many words rather than
                      leaving it to be inferred from a missing icon. */}
                  <div
                    className={[
                      'mb-4 rounded-2xl border-2 p-3 transition-colors',
                      encrypt ? 'border-ink-900/10 bg-cream-200' : 'border-tangerine-500 bg-tangerine-100',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={encrypt}
                      onClick={toggleEncrypt}
                      disabled={!vaultSupported && !encrypt}
                      className="flex w-full items-center gap-3 text-left disabled:opacity-60"
                    >
                      <span
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900',
                          encrypt ? 'bg-lime-400' : 'bg-cream-50',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        {encrypt ? (
                          <Lock className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          <Unlock className="h-4 w-4 text-ink-500" strokeWidth={3} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-sm font-extrabold leading-tight">
                          {encrypt ? 'Lock this one' : 'Not locked'}
                        </span>
                        <span
                          className={[
                            'mt-0.5 block text-[0.7rem] font-semibold leading-snug',
                            encrypt ? 'text-ink-400' : 'text-tangerine-600',
                          ].join(' ')}
                        >
                          {encrypt
                            ? vaultReady
                              ? 'Encrypted on this device before it’s saved.'
                              : vaultExists
                                ? 'Your passphrase is needed before this can save.'
                                : 'You’ll set a master passphrase for this.'
                            : 'Stored as plain text. Anyone signed into your account can read it.'}
                        </span>
                      </span>

                      <span
                        className={[
                          'relative h-7 w-12 shrink-0 rounded-pill border-2 border-ink-900 transition-colors',
                          encrypt ? 'bg-lime-400' : 'bg-cream-400',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        <span
                          className={[
                            'absolute top-[2px] h-[18px] w-[18px] rounded-full border-2 border-ink-900 bg-cream-50 transition-all',
                            encrypt ? 'left-[22px]' : 'left-[2px]',
                          ].join(' ')}
                        />
                      </span>
                    </button>

                    {!vaultSupported && !encrypt && (
                      <p className="mt-2 text-[0.7rem] font-semibold leading-snug text-tangerine-600">
                        This browser won’t encrypt on an insecure page, so the lock isn’t available
                        here. Open Zephr over https (or on localhost) to use it.
                      </p>
                    )}

                    {isEdit && encrypt !== Boolean(initialEncrypted) && (
                      <p className="mt-2 text-[0.7rem] font-semibold leading-snug text-ink-500">
                        {encrypt
                          ? 'Saving will encrypt this login for the first time.'
                          : 'Saving will store this login in plain text from now on.'}
                      </p>
                    )}
                  </div>

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

                  {/* ── Fields you name yourself ─────────────────────────
                      Username, password and website are the three every login
                      has; they are not the three every login *only* has. A PIN,
                      an account number, a security answer, the recovery email —
                      those went in the free-text box below and came back out as
                      something you had to read and retype. Named, they get the
                      same labelled, copyable line the username gets, and the
                      ones that need it get the password's redaction bar too.

                      They ride inside the same encrypted blob, so a new field
                      costs nothing on the server and nothing at rest. */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="label-caps">
                        Your own fields{' '}
                        {encrypt && (
                          <span className="normal-case tracking-normal text-ink-300">
                            · encrypted too
                          </span>
                        )}
                      </p>
                      {fields.length > 0 && (
                        <span className="nums text-[0.7rem] font-extrabold text-ink-300">
                          {fields.length} / {MAX_SECRET_FIELDS}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {fields.map((field) => (
                          <motion.div
                            key={field.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(event) =>
                                    patchField(field.id, { label: event.target.value })
                                  }
                                  maxLength={SECRET_FIELD_LABEL_MAX}
                                  autoFocus={focusField === field.id}
                                  placeholder="Field name — PIN, account no…"
                                  aria-label="Field name"
                                  autoComplete="off"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border-2 border-ink-900/15 bg-cream-50 px-3 font-display text-sm font-extrabold text-ink-900 transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                                />

                                {/* Hidden is about the *card*, not this input —
                                    you can always read what you're typing here. */}
                                <button
                                  type="button"
                                  onClick={() => patchField(field.id, { hidden: !field.hidden })}
                                  aria-pressed={field.hidden}
                                  aria-label="Keep this one covered on the card"
                                  title="Keep this one covered on the card"
                                  className={[
                                    'tactile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                                    field.hidden
                                      ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                                      : 'border-ink-900/15 bg-cream-50 text-ink-400',
                                  ].join(' ')}
                                >
                                  {field.hidden ? (
                                    <EyeOff className="h-4 w-4" strokeWidth={2.75} />
                                  ) : (
                                    <Eye className="h-4 w-4" strokeWidth={2.75} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeField(field.id)}
                                  aria-label={`Remove ${field.label.trim() || 'this field'}`}
                                  title="Remove this field"
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600"
                                >
                                  <X className="h-4 w-4" strokeWidth={3} />
                                </button>
                              </div>

                              <input
                                type="text"
                                value={field.value}
                                onChange={(event) =>
                                  patchField(field.id, { value: event.target.value })
                                }
                                maxLength={SECRET_FIELD_VALUE_MAX}
                                placeholder="What it says"
                                aria-label={`${field.label.trim() || 'Field'} value`}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                className="nums mt-1.5 min-h-[48px] w-full rounded-xl border-2 border-ink-900/15 bg-cream-50 px-3 text-[0.95rem] font-bold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-300 focus:border-lime-500"
                              />
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {fields.length < MAX_SECRET_FIELDS && (
                      <button
                        type="button"
                        onClick={addField}
                        className={[
                          'tactile inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-dashed border-ink-900/25 bg-cream-50 px-4 text-xs font-extrabold text-ink-500 transition-colors hover:border-ink-900 hover:text-ink-900',
                          fields.length > 0 ? 'mt-2' : '',
                        ].join(' ')}
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                        Add a field
                      </button>
                    )}
                  </div>

                  <div className="mb-5">
                    <label htmlFor="note-secretnote" className="label-caps mb-2 block">
                      Anything else{' '}
                      {encrypt && (
                        <span className="normal-case tracking-normal text-ink-300">
                          · encrypted too
                        </span>
                      )}
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
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {mode === 'list' ? (
                      <p className="label-caps">Checklist</p>
                    ) : (
                      <label htmlFor="note-body" className="label-caps">
                        Note
                      </label>
                    )}

                    {/* The same two words as the door above, kept on screen for
                        the case the door can't serve: a note you have already
                        written and now want tick boxes down. Converting is
                        lossless in both directions, so it's a toggle rather
                        than a decision — see switchMode. */}
                    <div className="flex shrink-0 items-center gap-1 rounded-pill border-2 border-ink-900/10 bg-cream-200 p-1">
                      {[
                        { id: 'text', label: 'Text', glyph: AlignLeft },
                        { id: 'list', label: 'List', glyph: ListTodo },
                      ].map((option) => {
                        const active = mode === option.id
                        const Glyph = option.glyph
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => switchMode(option.id)}
                            aria-pressed={active}
                            className={[
                              'flex min-h-[32px] items-center gap-1 rounded-pill px-2.5 text-[0.7rem] font-extrabold transition-colors',
                              active ? 'bg-ink-900 text-cream-50' : 'text-ink-400 hover:text-ink-900',
                            ].join(' ')}
                          >
                            <Glyph className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {mode === 'list' ? (
                    <div
                      className="note-paper on-light rounded-2xl border-[2.5px] border-ink-900/15 p-2 shadow-inset"
                      style={{ background: paper.paper }}
                    >
                      <ul>
                        <AnimatePresence initial={false}>
                          {items.map((item) => (
                            <motion.li
                              key={item.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                              className="flex items-start gap-1 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => patchItem(item.id, { done: !item.done })}
                                role="checkbox"
                                aria-checked={item.done}
                                aria-label={item.text.trim() || 'This item'}
                                className="flex h-11 w-9 shrink-0 items-center justify-center"
                              >
                                <span
                                  className={[
                                    'flex h-[1.2rem] w-[1.2rem] items-center justify-center rounded-[6px] border-2 transition-colors',
                                    item.done
                                      ? 'border-ink-900 bg-lime-400'
                                      : 'border-ink-900/35 bg-cream-50/70',
                                  ].join(' ')}
                                  aria-hidden="true"
                                >
                                  {item.done && (
                                    <Check className="h-3.5 w-3.5 text-ink-900" strokeWidth={4} />
                                  )}
                                </span>
                              </button>

                              {/* A textarea, not an input, and this is the
                                  whole reason: an item is often a sentence —
                                  "ring the clinic back about the scan" — and a
                                  single-line input scrolls it sideways out of
                                  sight, so you cannot read what you wrote. This
                                  wraps and grows instead. Newlines never reach
                                  the value: Enter opens the next row, and a
                                  pasted block is split into rows. */}
                              <textarea
                                rows={1}
                                value={item.text}
                                ref={(element) => {
                                  if (element) itemRefs.current.set(item.id, element)
                                  else itemRefs.current.delete(item.id)
                                }}
                                onChange={(event) => changeItem(item, event.target.value)}
                                onKeyDown={(event) => handleItemKey(event, item)}
                                maxLength={300}
                                placeholder="Something to do…"
                                aria-label="Item"
                                autoComplete="off"
                                className={[
                                  'min-h-[44px] min-w-0 flex-1 resize-none overflow-hidden rounded-xl border-2 border-transparent bg-transparent px-2 py-[0.6rem] text-[0.95rem] font-semibold leading-[1.4] outline-none transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500 focus:bg-cream-50/70',
                                  item.done ? 'text-ink-300 line-through' : 'text-ink-900',
                                ].join(' ')}
                              />

                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                aria-label={`Remove ${item.text.trim() || 'this item'}`}
                                title="Remove this item"
                                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600"
                              >
                                <X className="h-4 w-4" strokeWidth={3} />
                              </button>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>

                      <button
                        type="button"
                        onClick={() => addItem()}
                        className="tactile mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-dashed border-ink-900/25 px-4 text-xs font-extrabold text-ink-500 transition-colors hover:border-ink-900 hover:text-ink-900"
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                        Add an item
                      </button>
                    </div>
                  ) : (
                    <textarea
                      id="note-body"
                      ref={bodyRef}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      maxLength={20_000}
                      rows={5}
                      placeholder="Write it down before it’s gone…"
                      // Ruled, like the card it becomes. --rule-pad is how far
                      // the ruling has to reach back across this box's own left
                      // padding, so the red margin lands at the edge of the
                      // paper rather than at the edge of the writing.
                      className="note-paper ruled on-light w-full resize-none overflow-y-auto rounded-2xl border-[2.5px] border-ink-900/15 py-4 pl-[2.1rem] pr-4 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500 [--rule-pad:2.1rem]"
                      // backgroundColor, not the `background` shorthand: the
                      // ruling *is* a background-image, and the shorthand would
                      // quietly reset it to none.
                      style={{ backgroundColor: paper.paper }}
                    />
                  )}

                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    {mode === 'list' ? (
                      <>
                        <span className="nums text-[0.7rem] font-extrabold text-ink-300">
                          {ticked} of {items.filter((item) => item.text.trim()).length} ticked
                        </span>
                        {/* Sweeping the done ones off is the other half of a
                            list. It shows up only once there's something to
                            sweep, and it never touches an unticked row. */}
                        {ticked > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) => prev.filter((item) => !item.done || !item.text.trim()))
                            }
                            className="text-[0.7rem] font-extrabold text-ink-400 underline decoration-ink-900/20 underline-offset-2 transition-colors hover:text-coral-600"
                          >
                            Clear ticked
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="ml-auto text-[0.7rem] font-semibold text-ink-300">
                        {body.length.toLocaleString()} / 20,000
                      </span>
                    )}
                  </div>
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
                          'note-paper tactile relative h-11 w-11 overflow-hidden rounded-xl border-2 transition-colors',
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

                {/* Only on something that exists and isn't a login. A file of
                    what you've half-typed into a new note is a file of nothing,
                    and a login is never downloadable at all. */}
                {isEdit && !isSecret && !confirmingDelete && (
                  <DownloadButton
                    list={mode === 'list'}
                    disabled={!hasContent}
                    busy={downloading}
                    done={downloaded}
                    lost={lostGlyphs}
                    onPick={handleDownload}
                  />
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
                      ? isSecret && encrypt
                        ? 'Encrypting…'
                        : 'Saving…'
                      : !hasContent
                        ? isSecret
                          ? 'Add a password'
                          : mode === 'list'
                            ? 'Add an item first'
                            : 'Write something first'
                        : isEdit
                          ? 'Save changes'
                          : isSecret
                            ? encrypt
                              ? 'Lock it away'
                              : 'Save it'
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

/**
 * Save a copy of this note, in one of three formats.
 *
 * A menu rather than three buttons in the footer, because the footer already
 * carries delete and save and a fourth and fifth control there would push the
 * one people came for off the edge on a phone. A menu rather than one silent
 * default, because the formats are genuinely different documents: Markdown is
 * the note as text, the PDF is the note as paper you can print and tick with a
 * pen, and CSV is the list as rows in a spreadsheet.
 *
 * Escape isn't handled here on purpose. The sheet already listens for it on the
 * document, it was listening first, and a menu that swallowed the key would
 * leave people pressing it twice with nothing visibly happening the first time.
 */
function DownloadButton({ list, disabled, busy, done, lost, onPick }) {
  const [open, setOpen] = useState(false)
  const shellRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!shellRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const label = list ? 'Download this list' : 'Download this note'

  async function pick(format) {
    setOpen(false)
    await onPick(format)
  }

  return (
    <div ref={shellRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((on) => !on)}
        disabled={disabled || Boolean(busy)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'tactile flex min-h-[58px] w-[58px] items-center justify-center rounded-[1.25rem] border-[3px] border-ink-900 shadow-press transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
          done || open
            ? 'bg-lime-400 text-ink-900'
            : 'bg-cream-50 text-ink-400 hover:bg-cream-100 hover:text-ink-900',
        ].join(' ')}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : done ? (
          <Check className="h-5 w-5" strokeWidth={3} />
        ) : (
          <Download className="h-5 w-5" strokeWidth={2.75} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[236px] overflow-hidden rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-lift"
          >
            {DOWNLOAD_FORMATS.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => pick(option.id)}
                className={[
                  'flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-cream-200',
                  index > 0 ? 'border-t-2 border-ink-900/10' : '',
                ].join(' ')}
              >
                <option.icon
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={2.75}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block font-display text-sm font-extrabold leading-tight">
                    {option.label}
                  </span>
                  <span className="block text-[0.68rem] font-semibold leading-snug text-ink-400">
                    {option.id === 'pdf' && lost.length > 0
                      ? `${lost.length} character${lost.length === 1 ? '' : 's'} won’t print`
                      : option.hint}
                  </span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const DOWNLOAD_FORMATS = [
  { id: 'md', label: 'Markdown', hint: 'Text, tick boxes and all', icon: FileText },
  { id: 'pdf', label: 'PDF', hint: 'Ruled paper, ready to print', icon: Printer },
  { id: 'csv', label: 'CSV', hint: 'Rows for Excel or Sheets', icon: Table },
]
