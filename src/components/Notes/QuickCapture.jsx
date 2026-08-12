import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, KeyRound, Pin, Settings2 } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import { NOTE_COLORS, getColor } from '../../utils/noteHelpers'

/**
 * The fastest way onto the board: a strip of paper that's already out of the pad.
 *
 * The whole feature turns on this one control. A note you have to open a sheet
 * to write is a note you don't write — so the default path is click, type,
 * Enter, done, with no title, no colour decision and no dialog. Everything else
 * (a title, tags, a different paper) is one tap away behind "More", which hands
 * whatever you'd already typed to the full editor rather than throwing it away.
 *
 * ⌘/Ctrl+Enter saves from the keyboard. Escape collapses, and collapsing keeps
 * the draft — there's a difference between "not now" and "delete that".
 */
export default function QuickCapture({ onQuickSave, onExpand, onNewSecret, saving }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [color, setColor] = useState('cream')
  const [pinned, setPinned] = useState(false)

  const fieldRef = useRef(null)
  const shellRef = useRef(null)
  const paper = getColor(color)

  useLayoutEffect(() => {
    const field = fieldRef.current
    if (!field || !open) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 260)}px`
  }, [body, open])

  // Clicking away puts the pad down — but only if nothing was written. Losing
  // three lines of a note to a stray tap on the background is unforgivable, so
  // a draft holds the composer open until it's saved or cleared.
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (shellRef.current?.contains(event.target)) return
      if (body.trim()) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, body])

  async function save() {
    if (!body.trim() || saving) return
    const ok = await onQuickSave({
      kind: 'note',
      title: '',
      body: body.trim(),
      color,
      pinned,
      tags: [],
    })
    if (ok) {
      setBody('')
      setColor('cream')
      setPinned(false)
      setOpen(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div ref={shellRef} className="relative">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="rounded-[1.4rem] border-2 shadow-card"
        style={{ background: paper.paper, borderColor: paper.edge }}
      >
        {/* A strip of tape here too, so the composer is visibly the same object
            as the cards it produces. */}
        <span
          className="pointer-events-none absolute -top-2 left-8 h-5 w-16 -rotate-2 rounded-[3px] opacity-60 mix-blend-multiply"
          style={{
            background: `linear-gradient(180deg, ${paper.tape}cc, ${paper.tape}77)`,
            boxShadow: '0 1px 2px rgba(27,25,21,0.18)',
          }}
          aria-hidden="true"
        />

        {!open ? (
          <div className="flex items-center gap-2 p-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 text-left"
            >
              <Icon3D name="memo" size={26} />
              <span className="truncate font-display text-[0.95rem] font-extrabold text-ink-400">
                Jot something down…
              </span>
            </button>

            {/* The other half of the board deserves its own front door — going
                through "new note" and then flipping a toggle to save a password
                is one step too many for the thing people open this tab for. */}
            <button
              type="button"
              onClick={onNewSecret}
              aria-label="Save a password"
              title="Save a password"
              className="tactile flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-press-sm hover:bg-cream-100"
            >
              <KeyRound className="h-5 w-5" strokeWidth={2.75} />
            </button>
          </div>
        ) : (
          <div className="p-3">
            <textarea
              ref={fieldRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              maxLength={20_000}
              placeholder="Write it down before it’s gone…"
              aria-label="Note"
              className="w-full resize-none bg-transparent text-base font-semibold leading-relaxed text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300"
            />

            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t-2 border-ink-900/[0.07] pt-2.5">
              {NOTE_COLORS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setColor(option.id)}
                  aria-pressed={color === option.id}
                  aria-label={option.label}
                  title={option.label}
                  className={[
                    'h-7 w-7 shrink-0 rounded-full border-2 transition-transform',
                    color === option.id
                      ? 'scale-110 border-ink-900'
                      : 'border-ink-900/20 hover:scale-105',
                  ].join(' ')}
                  style={{ background: option.tape }}
                />
              ))}

              <span className="mx-0.5 h-6 w-px bg-ink-900/10" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setPinned((on) => !on)}
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin' : 'Pin to the top'}
                title={pinned ? 'Unpin' : 'Pin to the top'}
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                  pinned
                    ? 'border-ink-900 bg-lime-400'
                    : 'border-transparent text-ink-300 hover:bg-ink-900/[0.06] hover:text-ink-700',
                ].join(' ')}
              >
                <Pin className="h-4 w-4" strokeWidth={2.75} fill={pinned ? 'currentColor' : 'none'} />
              </button>

              <button
                type="button"
                onClick={() => {
                  onExpand({ body, color, pinned })
                  setBody('')
                  setOpen(false)
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[0.72rem] font-extrabold text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900"
              >
                <Settings2 className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                More
              </button>

              <button
                type="button"
                onClick={save}
                disabled={!body.trim() || saving}
                className="tactile ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink-900 bg-lime-400 px-4 font-display text-sm font-extrabold shadow-press-sm hover:bg-lime-300 disabled:opacity-40 disabled:shadow-none"
              >
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                {saving ? 'Pinning…' : 'Pin it'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Only on a real keyboard, where it's a genuine shortcut rather than
          advice you can't act on. */}
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 hidden px-2 text-[0.68rem] font-bold text-ink-300 lg:block"
          >
            ⌘/Ctrl + Enter to pin it up · Esc to put the pad down
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
