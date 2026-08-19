import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Pin, Trash2, X } from 'lucide-react'
import { checklistStats, getColor, noteFace, shortAgo, tiltFor } from '../../utils/noteHelpers'

/**
 * One paper note on the board.
 *
 * The card is a physical object: ruled stock off a pad, a strip of tape holding
 * it up, and a lean of a degree or two that belongs to that note forever (see
 * `tiltFor` — it's hashed from the id, not rolled at render, or the whole wall
 * would twitch on every keystroke in the search box). Hovering picks it up:
 * it straightens, lifts, and casts a longer shadow. Pinning drives a drawing
 * pin through the top, which is also what squares it up — a pinned note is the
 * one you meant to keep straight.
 *
 * The ruling is not decoration you can ignore when laying this out. Every line
 * of writing has to land on a rule, so everything inside the ruled block —
 * heading, prose, tick boxes — advances in whole multiples of `--rule` and
 * nothing in there carries a margin that isn't one. See `.ruled` in index.css.
 *
 * Tapping the face opens the editor, the way a chart row does. The one thing
 * that doesn't is a tick box: on a to-do list the box *is* the interaction, and
 * making someone open a sheet to cross off milk is how a list stops being used.
 * That's why the face is an absolutely-positioned button underneath the writing
 * rather than a button wrapped around it — a button can't be nested in one.
 */

/**
 * How tall a card is allowed to get, in ruled lines.
 *
 * A board is read by scanning it, and a card that runs to thirty lines stops
 * being a card and becomes a document — it pushes everything under it out of
 * sight and leaves the neighbouring column short, which is what makes a wall
 * of them look ragged. Eight lines is about a shopping list, which is the
 * length these actually are.
 *
 * Rules, not pixels, and not a CSS line-clamp: because line-height is exactly
 * one rule (see `.ruled`), a cut at a whole number of rules always lands
 * between two line boxes. Nothing is ever sliced through the middle — which a
 * line-clamp would do to a tick box, and half a tick box is a rendering bug.
 */
const MAX_RULES = 8

// A ceiling on how much is rendered at all, so a note pasted in from a
// document doesn't put a thousand list items into the DOM to draw eight.
const MAX_LINES = 24

export default function NoteCard({ note, onOpen, onTogglePin, onToggleTask, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const paper = getColor(note.color)
  const isPending = String(note.id).startsWith('optimistic-')
  const tilt = note.pinned ? 0 : tiltFor(note.id)

  const { heading, lines } = noteFace(note)
  const { done, total } = checklistStats(note.body)
  const shown = lines.slice(0, MAX_LINES)
  const complete = total > 0 && done === total

  /**
   * How much didn't fit, so the card can say so.
   *
   * Measured rather than counted, because a line that wraps takes two rules
   * and counting lines would promise eight and show five. The arithmetic is
   * only honest because every rule is exactly one line-height tall, so the
   * overflow divides into whole lines.
   *
   * The observer is for width: a card is clipped to a fixed height, so its own
   * box never resizes when the content changes — but the columns narrow at
   * every breakpoint, and text that fitted on one line at three columns wraps
   * onto two at one.
   */
  const clipRef = useRef(null)
  const [hiddenRules, setHiddenRules] = useState(0)

  useLayoutEffect(() => {
    const clip = clipRef.current
    if (!clip) return undefined

    const measure = () => {
      const rule = parseFloat(getComputedStyle(clip).lineHeight)
      if (!rule) return
      setHiddenRules(Math.round((clip.scrollHeight - clip.clientHeight) / rule))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(clip)
    return () => observer.disconnect()
  }, [note.body, note.title])

  // What was clipped, plus what was never rendered in the first place.
  const hidden = hiddenRules + (lines.length - shown.length)

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
        className="note-paper on-light relative rounded-[1.4rem] border-2 shadow-card transition-shadow hover:shadow-lift"
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

        <div className="relative">
          {/* The face. Underneath the writing rather than around it, so a tick
              box can sit on top of it and take its own taps. */}
          <button
            type="button"
            onClick={() => onOpen(note)}
            disabled={isPending}
            aria-label={`Edit ${heading || 'this note'}`}
            className="absolute inset-0 z-0 rounded-t-[1.3rem] disabled:opacity-60"
          />

          {/* The ruled sheet. Its only padding is the top one, which is what
              sets where the first rule falls; the writing's left and right
              margins go on the child, so the red margin rule can be measured
              from the edge of the paper rather than from the text.

              pointer-events-none so everything that isn't a tick box falls
              through to the face button behind it. */}
          <div className="ruled pointer-events-none relative z-10 pt-4 [--rule-gutter:1.55rem] [--rule:1.5rem]">
            <div className="pb-2 pl-[2.1rem] pr-4">
              {heading && (
                // Two rules per line, so bigger type still lands on the ruling;
                // clamped to one of them, so the block under it starts at the
                // same height on every card and the wall lines up.
                <h3 className="mb-0 line-clamp-1 font-display text-[0.98rem] font-extrabold tracking-tight text-ink-900 [line-height:calc(var(--rule)*2)]">
                  {heading}
                </h3>
              )}

              {shown.length > 0 && (
                <ul
                  ref={clipRef}
                  className="mt-0 overflow-hidden"
                  // Inline, not a Tailwind class: MAX_RULES is the one place
                  // the number lives, and Tailwind can't read it at build time.
                  style={{ maxHeight: `calc(var(--rule) * ${MAX_RULES})` }}
                >
                  {shown.map((line) =>
                    line.type === 'task' ? (
                      <li key={line.index} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleTask(note, line.index)}
                          disabled={isPending}
                          role="checkbox"
                          aria-checked={line.done}
                          aria-label={line.text.trim() || 'Untitled item'}
                          className="pointer-events-auto relative flex h-[var(--rule)] w-[1.05rem] shrink-0 items-center justify-center disabled:opacity-40"
                        >
                          {/* The hit area, expanded past the box it draws.
                              Absolute, so a thumb-sized target costs the ruling
                              nothing. */}
                          <span className="absolute -inset-x-2 -inset-y-[3px]" aria-hidden="true" />
                          <span
                            className={[
                              'flex h-[1.05rem] w-[1.05rem] items-center justify-center rounded-[5px] border-2 transition-colors',
                              line.done
                                ? 'border-ink-900 bg-lime-400'
                                : 'border-ink-900/35 bg-cream-50/70',
                            ].join(' ')}
                            aria-hidden="true"
                          >
                            {line.done && <Check className="h-3 w-3 text-ink-900" strokeWidth={4} />}
                          </span>
                        </button>

                        <span
                          className={[
                            'min-w-0 flex-1 break-words text-[0.83rem] font-semibold [min-height:var(--rule)]',
                            line.done ? 'text-ink-300 line-through' : 'text-ink-700',
                          ].join(' ')}
                        >
                          {line.text.trim() || '…'}
                        </span>
                      </li>
                    ) : (
                      <li
                        key={line.index}
                        // pre-wrap so a note keeps the spacing it was written
                        // with; the empty line still occupies its own rule.
                        className="whitespace-pre-wrap break-words text-[0.83rem] font-semibold text-ink-700 [min-height:var(--rule)]"
                      >
                        {line.text}
                      </li>
                    )
                  )}
                </ul>
              )}

              {hidden > 0 && (
                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.06em] text-ink-300 [min-height:var(--rule)]">
                  +{hidden} more {hidden === 1 ? 'line' : 'lines'}
                </p>
              )}

              {!heading && shown.length === 0 && (
                <p className="text-[0.83rem] font-semibold italic text-ink-300 [min-height:var(--rule)]">
                  Empty note
                </p>
              )}

              {note.tags?.length > 0 && (
                // A whole rule of clearance above, so the chips sit in the gap
                // rather than straddling a line.
                <div className="flex flex-wrap gap-1 pt-[calc(var(--rule)/2)]">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-pill border border-ink-900/15 bg-ink-900/[0.04] px-2 py-0.5 text-[0.62rem] font-extrabold uppercase leading-[1.4] tracking-[0.06em] text-ink-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex items-center gap-1 px-2 pb-2 pt-1">
          <span className="nums shrink-0 truncate pl-2 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-ink-400">
            {shortAgo(note.updated_at)}
          </span>

          {/* How far through the list, in the one place on the card with room
              for it. The bar is worth more than the numbers at a glance across
              a board, and the numbers are worth more than the bar up close, so
              it's both. */}
          {total > 0 && (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-1.5">
              <span
                className="h-1.5 min-w-[18px] flex-1 overflow-hidden rounded-pill bg-ink-900/10"
                aria-hidden="true"
              >
                <span
                  className={`block h-full rounded-pill transition-[width] duration-300 ${complete ? 'bg-lime-500' : 'bg-ink-900/45'}`}
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </span>
              <span className="nums shrink-0 text-[0.65rem] font-extrabold text-ink-400">
                {done}/{total}
              </span>
            </span>
          )}

          {total === 0 && <span className="flex-1" />}

          <button
            type="button"
            onClick={() => onTogglePin(note)}
            disabled={isPending}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? 'Unpin this note' : 'Pin this note'}
            title={note.pinned ? 'Unpin' : 'Pin to the top'}
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-30',
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.75} />
          </button>
        </footer>

        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 rounded-[1.3rem] bg-coral-100/95 p-4 backdrop-blur-[1px]"
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
