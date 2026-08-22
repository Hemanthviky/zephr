import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Download, ListTodo, Loader2, Lock, NotebookPen, Search, X } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import {
  downloadNote,
  exportable,
  headingFor,
  isTodo,
  noteRowCount,
  progressLabel,
  unsupportedGlyphs,
} from '../../utils/noteExport'
import { matchesQuery, shortAgo } from '../../utils/noteHelpers'

/**
 * Pick one thing, and save it.
 *
 * There is no "download everything" button, on purpose. An archive of the whole
 * board is the export nobody wants twice: you fetch it to get at the shopping
 * list and end up holding forty other things. So this is a list of what's on the
 * board and a Save on each row — you choose the note you meant, it lands in your
 * downloads, and the sheet stays open because the next thing you want is usually
 * the one under it.
 *
 * The same download also lives on the note itself (see NoteSheet), which is the
 * other half of the same idea: if it's already open, saving a copy shouldn't
 * mean closing it and finding it again in a list.
 *
 * The line about passwords is not a disclaimer. It's the question anyone
 * sensible asks when a password manager grows a download button, answered on the
 * screen where it's asked. Logins aren't listed here at all — the list is built
 * from `exportable`, which drops them before this component sees them.
 *
 * Everything is synchronous and local: the board is already in memory, and this
 * only rearranges it.
 */
export default function ExportSheet({ open, onClose, notes }) {
  const [format, setFormat] = useState('md')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  // Which row just saved, so the tap has a visible consequence — a file landing
  // in a folder you can't see is otherwise indistinguishable from nothing.
  const [saved, setSaved] = useState(null)
  // The PDF has a chunk to fetch on the first tap, so the row it came from says
  // it's working rather than sitting there looking broken.
  const [busy, setBusy] = useState(null)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setFilter('all')
      setSaved(null)
      setProblem(null)
      return undefined
    }
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(null), 2200)
    return () => clearTimeout(timer)
  }, [saved])

  // Only while the sheet is open: this walks every body looking for tick boxes,
  // and it's mounted beside a board that re-renders on every keystroke in the
  // board's own search box.
  const available = useMemo(() => (open ? exportable(notes) : []), [open, notes])

  const todoCount = useMemo(() => available.filter(isTodo).length, [available])

  const visible = useMemo(
    () =>
      available.filter((note) => {
        if (filter === 'todo' && !isTodo(note)) return false
        if (filter === 'note' && isTodo(note)) return false
        return matchesQuery(note, query)
      }),
    [available, filter, query]
  )

  const FILTERS = [
    { id: 'all', label: 'All', count: available.length },
    { id: 'todo', label: 'To-do', count: todoCount },
    { id: 'note', label: 'Notes', count: available.length - todoCount },
  ]

  /**
   * Save one note.
   *
   * Markdown and CSV are built and handed over synchronously; only the PDF
   * awaits anything, and only the first time — jsPDF is fetched on demand. If
   * that fetch fails (offline, usually) the row says so and points at the two
   * formats that need nothing from the network.
   */
  async function save(note) {
    if (busy) return
    setProblem(null)
    setBusy(note.id)
    try {
      if (await downloadNote(note, format)) setSaved(note.id)
    } catch (err) {
      setProblem('Couldn’t build that PDF. Markdown and CSV work offline — try one of those.')
      // The message above is all anyone can act on; whatever jsPDF objected to
      // shouldn't vanish with it.
      console.error('[Zephr] note PDF failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
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
            aria-label="Download a note"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="sheet max-w-[480px]"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-start gap-3 px-5 pb-2 pt-4">
              <Icon3D name="notepad" size={40} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight">
                  Download a note
                </h2>
                <p className="mt-0.5 text-xs font-bold leading-snug text-ink-400">
                  One at a time — pick the note or list you want as a file.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <div className="shrink-0 px-5 pt-2">
              {/* ── Format ────────────────────────────────────────────────── */}
              {/* Three buttons and one line, rather than three buttons each
                  carrying their own caption: at this width a caption per
                  button is two words wrapped to three lines. Only the chosen
                  format's caption is worth reading anyway. */}
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="File format">
                {FORMATS.map((option) => {
                  const active = format === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFormat(option.id)}
                      className={[
                        'tactile min-h-[44px] rounded-2xl border-2 px-2 font-display text-sm font-extrabold transition-colors',
                        active
                          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                          : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/40',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <p className="mt-1.5 text-[0.7rem] font-bold leading-snug text-ink-400">
                {FORMATS.find((option) => option.id === format).hint}
              </p>

              {/* ── Finding the one you mean ──────────────────────────────── */}
              {available.length > 6 && (
                <div className="relative mt-3">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
                    strokeWidth={2.75}
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a note…"
                    aria-label="Find a note to download"
                    className="min-h-[44px] w-full rounded-2xl border-2 border-ink-900/10 bg-cream-50 pl-10 pr-3 text-sm font-bold text-ink-900 transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500 [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
              )}

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
                        'tactile inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors',
                        active
                          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                          : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/40',
                      ].join(' ')}
                    >
                      {option.label}
                      <span className={`nums ${active ? 'text-ink-700' : 'text-ink-300'}`}>
                        {option.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── The list ────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3">
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm font-semibold text-ink-400">
                  {available.length === 0
                    ? 'Nothing on the board to download yet.'
                    : 'Nothing here matches that.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {visible.map((note) => (
                    <li key={note.id}>
                      <PickRow
                        note={note}
                        format={format}
                        justSaved={saved === note.id}
                        working={busy === note.id}
                        onSave={() => save(note)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {problem && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-xs font-semibold leading-relaxed text-coral-600"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                  <span>{problem}</span>
                </p>
              )}
            </div>

            {/* ── The question everyone asks ──────────────────────────────── */}
            <div className="shrink-0 border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-3 pb-safe">
              <p className="flex items-start gap-2.5 pb-3 text-xs font-semibold leading-relaxed text-ink-500">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} aria-hidden="true" />
                <span>
                  <strong className="font-extrabold text-ink-900">
                    Saved logins can’t be downloaded.
                  </strong>{' '}
                  They aren’t in this list, unlocked or not — a password only leaves Zephr when you
                  copy one yourself.
                </span>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

const FORMATS = [
  {
    id: 'md',
    label: 'Markdown',
    hint: 'Plain text that opens anywhere, with the tick boxes still tickable.',
  },
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'Laid out on ruled paper, boxes drawn — for printing or sending on.',
  },
  { id: 'csv', label: 'CSV', hint: 'One line per row, for Excel or Sheets.' },
]

/** What the screen reader hears, which isn't always what the button says. */
const FORMAT_NAMES = { md: 'Markdown', pdf: 'a PDF', csv: 'CSV' }

/**
 * One note, and the button that saves it.
 *
 * The whole row is the button: on a phone, a 44px target on the right of a list
 * item is the one people miss, and there is nothing else you'd want to do to a
 * row in this sheet.
 */
function PickRow({ note, format, justSaved, working, onSave }) {
  const list = isTodo(note)
  const rows = noteRowCount(note)

  // Only asked of a PDF, and only while this sheet is up: it walks the whole
  // note, and the answer can't change for any other format.
  const lost = useMemo(
    () => (format === 'pdf' ? unsupportedGlyphs(note) : []),
    [format, note]
  )

  // What the file will hold, in the units of the format you've chosen — a CSV
  // of a list is rows, and saying "4 items" over a file with 31 rows in it is
  // the small lie that makes people stop trusting the number.
  const meta = [
    format === 'csv'
      ? `${rows} ${rows === 1 ? 'row' : 'rows'}`
      : list
        ? progressLabel(note)
        : `${rows} ${rows === 1 ? 'line' : 'lines'}`,
    shortAgo(note.updated_at),
  ].filter(Boolean)

  const Kind = list ? ListTodo : NotebookPen

  return (
    <button
      type="button"
      onClick={onSave}
      aria-busy={working || undefined}
      aria-label={`Download ${headingFor(note)} as ${FORMAT_NAMES[format]}`}
      className={[
        'tactile flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors',
        justSaved
          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
          : 'border-ink-900/10 bg-cream-50 hover:border-ink-900/40 hover:bg-cream-100',
      ].join(' ')}
    >
      <Kind
        className={`h-5 w-5 shrink-0 ${justSaved ? 'text-ink-900' : 'text-ink-400'}`}
        strokeWidth={2.75}
        aria-hidden="true"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-extrabold leading-tight">
          {headingFor(note)}
        </span>
        <span
          className={`block truncate text-[0.68rem] font-bold ${
            justSaved ? 'text-ink-700' : 'text-ink-400'
          }`}
        >
          {justSaved ? 'Saved to your downloads' : working ? 'Building…' : meta.join(' · ')}
        </span>

        {/* Said on the row it applies to, before the tap: Helvetica has no
            glyph for an emoji or for Tamil, and a PDF would drop them silently
            while Markdown, one button away, keeps every one. */}
        {lost.length > 0 && !justSaved && !working && (
          <span className="mt-0.5 flex items-center gap-1 text-[0.66rem] font-bold text-ink-400">
            <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />
            <span className="truncate">
              {lost.length === 1 ? `${lost[0]} won’t print` : `${lost.length} characters won’t print`}
            </span>
          </span>
        )}
      </span>

      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
        aria-hidden="true"
      >
        {working ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.75} />
        ) : (
          <Download className="h-4 w-4" strokeWidth={2.75} />
        )}
      </span>
    </button>
  )
}
