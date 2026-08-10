import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import Icon3D from '../shared/Icon3D'

/**
 * The chart's dropdown — what was in the cup, or what form the medicine came in.
 *
 * It expands *in flow* rather than floating over the page. A sheet on a phone is
 * already a scroll container, and an absolutely positioned menu inside one is a
 * standing bet that the list is short enough not to be clipped by the fold. This
 * pushes the fields below it down instead, which can't be clipped by anything,
 * and closes itself the moment you choose.
 *
 * Options carry their own tint, so the row you pick looks like the row it will
 * become on the chart.
 */
export default function ItemSelect({
  label,
  options,
  value,
  onChange,
  hint,
  id,
  placeholder = 'Choose one',
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const selected = options.find((option) => option.id === value) ?? null

  // Escape closes and hands focus back, rather than leaving it stranded on an
  // option that just disappeared.
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation() // the sheet also listens for Escape
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  function pick(option) {
    onChange(option)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div>
      {label && (
        <label className="label-caps mb-2 block" htmlFor={id} id={id ? `${id}-label` : undefined}>
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className={[
          'tactile flex min-h-[68px] w-full items-center gap-3 rounded-2xl border-[2.5px] bg-cream-50 px-3 text-left transition-colors',
          open ? 'border-ink-900 shadow-press-sm' : 'border-ink-900/15 hover:border-ink-900/35',
        ].join(' ')}
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900/10"
          style={{ background: selected ? `${selected.tint}22` : undefined }}
          aria-hidden="true"
        >
          {selected ? (
            <Icon3D name={selected.icon} size={26} />
          ) : (
            <span className="text-xl text-ink-300">?</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-extrabold leading-tight">
            {selected ? selected.name : placeholder}
          </span>
          <span className="block truncate text-xs font-bold text-ink-400">
            {selected?.meta ?? (open ? 'Pick from the list' : 'Tap to change')}
          </span>
        </span>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={3}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="overflow-hidden"
          >
            <ul
              className="mt-2 max-h-[19rem] space-y-1 overflow-y-auto rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1.5"
              aria-labelledby={id ? `${id}-label` : undefined}
            >
              {options.map((option) => {
                const active = option.id === value
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => pick(option)}
                      aria-pressed={active}
                      className={[
                        'flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border-2 px-2 text-left transition-colors',
                        active
                          ? 'border-ink-900 bg-cream-50'
                          : 'border-transparent hover:border-ink-900/20 hover:bg-cream-50/70',
                      ].join(' ')}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${option.tint}22` }}
                        aria-hidden="true"
                      >
                        <Icon3D name={option.icon} size={21} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold leading-tight">
                          {option.name}
                        </span>
                        {option.meta && (
                          <span className="block truncate text-[0.68rem] font-bold text-ink-400">
                            {option.meta}
                          </span>
                        )}
                      </span>

                      {active && (
                        <Check className="h-4 w-4 shrink-0" strokeWidth={3.5} aria-hidden="true" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {hint && <p className="mt-1.5 text-xs font-semibold text-ink-400">{hint}</p>}
    </div>
  )
}
