import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { formatHM12, from12, nowHM, to12 } from '../../utils/hospitalMath'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
/**
 * Twelve minutes, not sixty — one per numeral on the face beside it.
 *
 * Both pickers are then the same twelve cells in the same two rows, which is
 * the only way two dropdowns of 12 and 60 items ever open to the same height.
 * The minutes in between aren't lost: that's what the dial and ±5 are for, and
 * a 60-item list was the tall scroller this field was built to get rid of.
 */
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5)
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)

/**
 * When it happened — a clock face you can actually turn.
 *
 * Deliberately not `<input type="time">`: that control's face is chosen by the
 * browser's own locale, so the same page reads "8:42 pm" on one machine and
 * "20:42" on the next, and no HTML attribute can ask it for one or the other.
 * Here 24-hour time never appears; 'HH:MM' survives only as the value handed to
 * the database.
 *
 * The dial is the whole point. Drag it and the minute hand follows your thumb —
 * which is both the fastest way to say "quarter past" and, at 88px square, less
 * height than the stacked pickers it replaces. The hour stays a native <select>
 * (a phone gives it a scroll wheel of its own) because dragging a single dial
 * for both is how you end up setting 3:05 when you meant 4:00.
 *
 * Pre-filled with the clock, since 95% of the time you're logging the cup in
 * your hand. ±5 is for the ordinary correction, ↺ for getting back to now.
 */
export default function TimeField({ value, onChange, id = 'chart-time', label = 'Time' }) {
  const { hour, minute, meridiem } = to12(value)
  const dialRef = useRef(null)
  const dragging = useRef(false)
  // Which picker is open, if either. One slot below the card holds both, so
  // opening the hour and opening the minute move nothing on the page.
  const [panel, setPanel] = useState(null)

  const isNow = value === nowHM()

  const setPart = (patch) =>
    onChange(from12(patch.hour ?? hour, patch.minute ?? minute, patch.meridiem ?? meridiem))

  const shift = (minutes) => onChange(shiftHM(value, minutes))

  /**
   * Where on the face the pointer is, as a minute. 12 o'clock is 0, clockwise.
   *
   * Reads the coordinates out of either a pointer/mouse event or the first
   * touch, so the same maths serves both handlers below.
   */
  function minuteAt(event) {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return minute

    const point = event.touches?.[0] ?? event.changedTouches?.[0] ?? event
    if (typeof point.clientX !== 'number') return minute

    const dx = point.clientX - (rect.left + rect.width / 2)
    const dy = point.clientY - (rect.top + rect.height / 2)
    const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    return Math.round(degrees / 6) % 60
  }

  function startDrag(event) {
    dragging.current = true
    // Optional because SVG elements in some older engines don't implement it,
    // and because a browser may refuse capture for a pointer it has released.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      /* dragging still works; it just stops tracking outside the dial */
    }
    setPart({ minute: minuteAt(event) })
  }

  function onDrag(event) {
    if (!dragging.current) return
    setPart({ minute: minuteAt(event) })
  }

  function endDrag(event) {
    dragging.current = false
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      /* the pointer was already gone — nothing to release */
    }
  }

  /**
   * Touch fallback for engines without Pointer Events (iOS Safari before 13,
   * and a few Android webviews). Bound only when they're missing, so nothing
   * handles the same drag twice on a browser that has both.
   */
  const hasPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window

  const touchHandlers = hasPointerEvents
    ? null
    : {
        onTouchStart: (event) => {
          dragging.current = true
          setPart({ minute: minuteAt(event) })
        },
        onTouchMove: (event) => {
          if (!dragging.current) return
          // The dial owns this gesture; without this the page scrolls under it.
          event.preventDefault()
          setPart({ minute: minuteAt(event) })
        },
        onTouchEnd: () => {
          dragging.current = false
        },
      }

  function onDialKey(event) {
    const step = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1
        : event.key === 'PageUp' ? 5
          : event.key === 'PageDown' ? -5
            : 0
    if (!step) return
    event.preventDefault()
    setPart({ minute: (minute + step + 60) % 60 })
  }

  // Hands. The hour hand creeps between the numerals as the minutes pass, which
  // is what stops the face reading as a sticker.
  const minuteAngle = minute * 6
  const hourAngle = (hour % 12) * 30 + minute * 0.5

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="label-caps" id={`${id}-label`}>
          {label}
        </span>
        <span className="nums text-xs font-bold text-ink-400">{formatHM12(value)}</span>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 p-2.5 shadow-inset">
        {/* ── The dial ─────────────────────────────────────────────────── */}
        <svg
          ref={dialRef}
          viewBox="0 0 100 100"
          role="slider"
          tabIndex={0}
          aria-label="Minutes — drag the dial"
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={minute}
          aria-valuetext={formatHM12(value)}
          onPointerDown={hasPointerEvents ? startDrag : undefined}
          onPointerMove={hasPointerEvents ? onDrag : undefined}
          onPointerUp={hasPointerEvents ? endDrag : undefined}
          onPointerCancel={hasPointerEvents ? endDrag : undefined}
          {...(touchHandlers ?? {})}
          onKeyDown={onDialKey}
          // touch-action inline as well as in the class: Safari has historically
          // ignored the property on SVG elements when it arrives via a
          // stylesheet, and without it the drag scrolls the sheet instead.
          style={{ touchAction: 'none' }}
          className="h-[88px] w-[88px] shrink-0 cursor-grab touch-none select-none rounded-full active:cursor-grabbing"
        >
          <circle cx="50" cy="50" r="46" fill="#FDF7EA" stroke="#1B1915" strokeWidth="3" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(27,25,21,0.08)" strokeWidth="1.5" />

          {TICKS.map((angle, index) => (
            <line
              key={angle}
              x1="50"
              y1={index % 3 === 0 ? 9 : 11}
              x2="50"
              y2={index % 3 === 0 ? 17 : 15}
              stroke="#1B1915"
              strokeOpacity={index % 3 === 0 ? 0.75 : 0.28}
              strokeWidth={index % 3 === 0 ? 3.5 : 2}
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}

          {/* Minute hand — the one under your thumb, so it's the coloured one. */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="19"
            stroke="#12B39A"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(${minuteAngle} 50 50)`}
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="31"
            stroke="#1B1915"
            strokeWidth="5.5"
            strokeLinecap="round"
            transform={`rotate(${hourAngle} 50 50)`}
          />

          <circle cx="50" cy="50" r="4" fill="#1B1915" />
          <circle cx="50" cy="50" r="1.6" fill="#FDF7EA" />

          <text
            x="50"
            y="72"
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            letterSpacing="1"
            fill="#948B7B"
          >
            {meridiem}
          </text>
        </svg>

        {/* ── The readout, which is also the input ─────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5">
            <Part
              id={`${id}-hour`}
              label="Hour"
              display={hour}
              open={panel === 'hour'}
              onToggle={() => setPanel((open) => (open === 'hour' ? null : 'hour'))}
            />
            <span
              className="font-display text-2xl font-extrabold leading-none text-ink-300"
              aria-hidden="true"
            >
              :
            </span>
            <Part
              id={`${id}-minute`}
              label="Minute"
              display={String(minute).padStart(2, '0')}
              open={panel === 'minute'}
              onToggle={() => setPanel((open) => (open === 'minute' ? null : 'minute'))}
            />
          </div>

          <div className="mt-1.5 flex items-stretch gap-1.5">
            <div
              className="grid grid-cols-2 gap-0.5 rounded-xl border-2 border-ink-900/10 bg-cream-200 p-0.5"
              role="radiogroup"
              aria-labelledby={`${id}-label`}
            >
              {['AM', 'PM'].map((option) => {
                const active = meridiem === option
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPart({ meridiem: option })}
                    className={[
                      'min-h-[34px] rounded-lg px-2 font-display text-xs font-extrabold transition-colors',
                      active ? 'border-2 border-ink-900 bg-lime-400' : 'text-ink-400 hover:bg-cream-50',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => shift(-5)}
              aria-label="Five minutes earlier"
              title="−5 min"
              className="tactile flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
            >
              <Minus className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => shift(5)}
              aria-label="Five minutes later"
              title="+5 min"
              className="tactile flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
            >
              <Plus className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChange(nowHM())}
              disabled={isNow}
              aria-label="Set to now"
              title="Now"
              className="tactile flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm disabled:opacity-40 disabled:shadow-none"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* One panel, two pickers, twelve cells either way — so the hour list and
          the minute list are exactly the same size, and neither can push the
          rest of the form around when it opens. */}
      <AnimatePresence initial={false}>
        {panel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1.5">
              <p className="label-caps px-1 pb-1.5">
                {panel === 'hour' ? 'Hour' : 'Minutes · drag the dial for the ones between'}
              </p>
              <div className="grid grid-cols-6 gap-1" role="group">
                {(panel === 'hour' ? HOURS : MINUTE_STEPS).map((option) => {
                  const active = panel === 'hour' ? option === hour : option === minute
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setPart(panel === 'hour' ? { hour: option } : { minute: option })
                        setPanel(null)
                      }}
                      className={[
                        'nums tactile min-h-[38px] rounded-xl border-2 font-display text-sm font-extrabold transition-colors',
                        active
                          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                          : 'border-transparent bg-cream-50 text-ink-500 hover:border-ink-900/25',
                      ].join(' ')}
                    >
                      {panel === 'hour' ? option : String(option).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One half of the digital readout, and the button that opens its picker.
 *
 * Not a native <select>: the browser sizes that popup to its option count, so
 * an hour list and a minute list can never open to the same height however
 * they're styled. This opens the shared grid below instead.
 */
function Part({ id, label, display, open, onToggle }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${label}: ${display}`}
      className={[
        'nums tactile h-[44px] min-w-0 flex-1 rounded-xl border-2 font-display text-2xl font-extrabold text-ink-900 transition-colors',
        open ? 'border-ink-900 bg-cream-50 shadow-press-sm' : 'border-transparent bg-cream-200 hover:border-ink-900/20',
      ].join(' ')}
    >
      {display}
    </button>
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
