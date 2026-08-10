import { Clock, Minus, Plus, RotateCcw } from 'lucide-react'
import { nowHM } from '../../utils/hospitalMath'

/**
 * When it happened.
 *
 * Pre-filled with the clock, because 95% of the time you're logging the cup
 * you're holding — and fully editable, because the other 5% is remembering at
 * 4pm that the 11am dose went in. The ±5 minute buttons exist for the common
 * correction ("it was just before the round"), the native time input for the
 * uncommon one, and "Now" to get back after either.
 *
 * The control is a real <input type="time">, so a phone opens its own clock
 * picker and a keyboard user can just type — neither of which a bespoke
 * spinner would give for free.
 */
export default function TimeField({ value, onChange, id = 'chart-time', label = 'Time' }) {
  const isNow = value === nowHM()

  const shift = (minutes) => onChange(shiftHM(value, minutes))

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label-caps">
          {label}
        </label>
        <span className="text-xs font-bold text-ink-400">{describe(value)}</span>
      </div>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => shift(-5)}
          aria-label="Five minutes earlier"
          className="tactile flex h-[68px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
        >
          <Minus className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Clock
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300"
            strokeWidth={2.75}
            aria-hidden="true"
          />
          <input
            id={id}
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value || nowHM())}
            className="nums h-[68px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 pl-12 pr-3 font-display text-2xl font-extrabold text-ink-900 shadow-inset transition-colors focus:border-lime-500"
          />
        </div>

        <button
          type="button"
          onClick={() => shift(5)}
          aria-label="Five minutes later"
          className="tactile flex h-[68px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
        >
          <Plus className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChange(nowHM())}
        disabled={isNow}
        className="tactile mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-ink-900 bg-lime-400 px-3.5 text-xs font-extrabold shadow-press-sm disabled:opacity-40 disabled:shadow-none"
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        {isNow ? 'Set to now' : 'Back to now'}
      </button>
    </div>
  )
}

/** 'HH:MM' ± minutes, wrapping inside the day rather than spilling into another. */
function shiftHM(hm, minutes) {
  const [h, m] = String(hm ?? '')
    .split(':')
    .map(Number)
  const base = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  const next = ((base + minutes) % 1440 + 1440) % 1440
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
}

/** '8:42 pm' under the label — the 24h field alone reads as a form, not a time. */
function describe(hm) {
  const [h, m] = String(hm ?? '')
    .split(':')
    .map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
