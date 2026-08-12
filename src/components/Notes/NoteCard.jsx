import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Pin, Trash2, X } from 'lucide-react'
import { bodyPreview, firstLine, getColor, shortAgo, tiltFor } from '../../utils/noteHelpers'

/**
 * One paper note on the board.
 *
 * The card is a physical object: coloured stock, a strip of tape holding it up,
 * and a lean of a degree or two that belongs to that note forever (see
 * `tiltFor` — it's hashed from the id, not rolled at render, or the whole wall
 * would twitch on every keystroke in the search box). Hovering picks it up:
 * it straightens, lifts, and casts a longer shadow. Pinning drives a drawing
 * pin through the top, which is also what squares it up — a pinned note is the
 * one you meant to keep straight.
 *
 * The whole face is the edit target, the way a chart row is. Pin and delete are
 * the only two things competing with it, they live in the footer, and delete
 * confirms in place rather than in a modal.
 */
export default function NoteCard({ note, onOpen, onTogglePin, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const paper = getColor(note.color)
  const isPending = String(note.id).startsWith('optimistic-')
  const tilt = note.pinned ? 0 : tiltFor(note.id)

  const heading = note.title?.trim() || firstLine(note.body)
  const preview = bodyPreview(note)

  async function handleDelete() {
    setDeleting(true)
    const ok = await onDelete(note.id)
    if (!ok) {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      // break-inside-avoid is what keeps a card whole across a column break;
      // without it a long note is guillotined down the middle of a sentence.
      className="mb-4 break-inside-avoid"
      style={{ breakInside: 'avoid' }}
    >
      <motion.article
        animate={{ rotate: tilt }}
        whileHover={{ rotate: 0, y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative rounded-[1.4rem] border-2 shadow-card transition-shadow hover:shadow-lift"
        style={{ background: paper.paper, borderColor: paper.edge }}
      >
        {/* The tape. Sits half off the top edge, leaning the other way to the
            card, which is what stops six of these in a column looking printed. */}
        {!note.pinned && (
          <span
            className="pointer-events-none absolute -top-2 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 rounded-[3px] opacity-60 mix-blend-multiply"
            style={{
              background: `linear-gradient(180deg, ${paper.tape}cc, ${paper.tape}77)`,
              boxShadow: '0 1px 2px rgba(27,25,21,0.18)',
            }}
            aria-hidden="true"
          />
        )}

        {note.pinned && (
          <span
            className="pointer-events-none absolute -top-3 right-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-900 shadow-press-sm"
            style={{ background: paper.tape }}
            aria-hidden="true"
          >
            <Pin className="h-3.5 w-3.5 text-ink-900" strokeWidth={3} fill="currentColor" />
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpen(note)}
          disabled={isPending}
          aria-label={`Edit ${heading || 'this note'}`}
          className="block w-full rounded-t-[1.3rem] px-4 pb-2 pt-5 text-left disabled:opacity-60"
        >
          {heading && (
            <h3 className="font-display text-[0.98rem] font-extrabold leading-snug tracking-tight text-ink-900">
              {heading}
            </h3>
          )}

          {preview && (
            // pre-wrap, because a note is written with its line breaks in it
            // and a shopping list that reflows into a paragraph is not a list.
            <p
              className={[
                'whitespace-pre-wrap break-words text-[0.83rem] font-semibold leading-relaxed text-ink-700',
                heading ? 'mt-1.5' : '',
                'line-clamp-[12]',
              ].join(' ')}
            >
              {preview}
            </p>
          )}

          {!heading && !preview && (
            <p className="text-[0.83rem] font-semibold italic text-ink-300">Empty note</p>
          )}

          {note.tags?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-pill border border-ink-900/15 bg-ink-900/[0.04] px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-ink-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </button>

        <footer className="flex items-center gap-1 px-2 pb-2 pt-1">
          <span className="nums flex-1 truncate pl-2 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-ink-400">
            {shortAgo(note.updated_at)}
          </span>

          <button
            type="button"
            onClick={() => onTogglePin(note)}
            disabled={isPending}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? 'Unpin this note' : 'Pin this note'}
            title={note.pinned ? 'Unpin' : 'Pin to the top'}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-30',
              note.pinned
                ? 'text-ink-900'
                : 'text-ink-300 hover:bg-ink-900/[0.06] hover:text-ink-700',
            ].join(' ')}
          >
            <Pin className="h-4 w-4" strokeWidth={2.75} fill={note.pinned ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending}
            aria-label="Delete this note"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.75} />
          </button>
        </footer>

        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[1.3rem] bg-coral-100/95 p-4 backdrop-blur-[1px]"
          >
            <p className="text-center font-display text-sm font-extrabold leading-tight text-coral-600">
              Take it off the board?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                aria-label="Keep it"
                className="tactile flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Confirm delete"
                className="tactile flex h-11 min-w-[68px] items-center justify-center gap-1 rounded-xl border-2 border-ink-900 bg-coral-500 px-3 font-display text-sm font-extrabold text-cream-50 shadow-press-coral"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                Yes
              </button>
            </div>
          </motion.div>
        )}
      </motion.article>
    </motion.li>
  )
}
