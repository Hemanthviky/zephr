import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { addDays, fromISODate, toISODate, todayISO } from '../../utils/dateHelpers'

/**
 * The jump-to-a-date popover, in two modes.
 *
 *   mode="day"   — a month of days, for the Food tab's date navigator.
 *   mode="month" — a year of months, for the Money tab's month navigator.
 *
 * One component rather than two because the two navigators are the same
 * control: arrows either side of a label you can tap to go somewhere directly.
 * Building a separate calendar per module is how the two tabs end up with
 * different-looking pickers, different disabled rules and, eventually, two
 * different bugs. The grid inside changes; the frame, the keys, the "back to
 * now" escape hatch and the it-hasn't-happened-yet rule do not.
 *
 * The future is unreachable here for the same reason the forward arrow is
 * disabled: you can't have eaten tomorrow's lunch, and an empty month you can
 * navigate to but never fill is a dead end, not a feature.
 *
 * Three things the plain grid didn't do, all of them the same complaint —
 * *last March is too far away*:
 *   • the header label in day mode drills up to a year of months, so any month
 *     is two taps rather than one tap per month travelled;
 *   • a horizontal swipe pages the grid, which is what a thumb tries first;
 *   • the arrow keys walk the grid for anyone on a keyboard, with the month
 *     following the cursor across its own edges.
 */

/* ── Formatters ───────────────────────────────────────────────────────────── */

// Intl.DateTimeFormat is expensive to construct and cheap to reuse, and
// `toLocaleDateString` builds a fresh one on every call — 42 of them per render
// of a day grid. Build each one once, at module load, and format against it.
const formatter = (options) => new Intl.DateTimeFormat(undefined, options)

const F_DAY_FULL = formatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const F_MONTH_YEAR = formatter({ month: 'long', year: 'numeric' })
const F_MONTH_SHORT = formatter({ month: 'short' })
const F_WEEKDAY_NARROW = formatter({ weekday: 'narrow' })

/** Sunday-first, labelled from the browser's own locale. 7 Jan 2024 was a Sunday. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  F_WEEKDAY_NARROW.format(new Date(2024, 0, 7 + i))
)

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => F_MONTH_SHORT.format(new Date(2024, i, 1)))

/* ── Date arithmetic ──────────────────────────────────────────────────────── */

const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' → 'YYYY-MM-01'. The Money tab's idea of a month. */
const monthStart = (iso) => `${iso.slice(0, 7)}-01`

/**
 * Shift an ISO day by ±n months, keeping the day-of-month where the target
 * month is long enough to hold it. Without the clamp, 31 January + 1 month is
 * 3 March and the cursor teleports past February entirely.
 */
function shiftMonths(iso, n) {
  const d = fromISODate(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return toISODate(target)
}

/**
 * Put a month's cursor day onto another month, clamped twice: to the length of
 * the target month (there is no 31st of February) and to today (a cursor parked
 * on a disabled cell is a grid with no tab stop).
 */
function withDayOf(monthIso, dayIso, today) {
  const year = Number(monthIso.slice(0, 4))
  const month = Number(monthIso.slice(5, 7)) - 1
  const lastDay = new Date(year, month + 1, 0).getDate()
  const landed = toISODate(new Date(year, month, Math.min(Number(dayIso.slice(8)), lastDay)))
  return landed > today ? today : landed
}

/** Six rows, always — a grid that changes height re-lays out the popover under the thumb. */
const GRID_CELLS = 42

/** How far a drag has to travel (with its own momentum added) to turn the page. */
const SWIPE_THRESHOLD = 55

/* ── Shell ────────────────────────────────────────────────────────────────── */

export default function PeriodPicker({ open, onClose, mode = 'day', value, onSelect }) {
  const isDay = mode === 'day'
  const today = todayISO()
  const reduceMotion = useReducedMotion()

  // A malformed value would otherwise render a grid of "NaN". Today is the one
  // fallback that's always safe and always reachable.
  const safeValue = ISO_SHAPE.test(value ?? '') ? value : isDay ? today : monthStart(today)

  // The cursor is where the grid is looking *and* where the keyboard is: one
  // piece of state, so arrow keys crossing a month boundary page the grid for
  // free instead of needing the two kept in sync.
  const [cursor, setCursor] = useState(safeValue)
  // Day mode drills up to a year of months and back down; month mode is only
  // ever the one view.
  const [drilled, setDrilled] = useState(false)
  // Which way the last move went, so the grid slides with the swipe.
  const [dir, setDir] = useState(0)

  const panelRef = useRef(null)
  // Focus follows the cursor only when the keyboard moved it. Clicking an arrow
  // must leave focus on the arrow, or the second click lands on nothing.
  const focusPending = useRef(false)

  // Reseed on open so reopening never strands you wherever you last browsed to.
  useEffect(() => {
    if (!open) return
    setCursor(safeValue)
    setDrilled(false)
    setDir(0)
  }, [open, safeValue])

  // Give focus back to whatever opened us. Without this, dismissing the picker
  // drops focus on <body> and the next Tab restarts from the top of the page.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pick = useCallback(
    (iso) => {
      onSelect(iso)
      onClose()
    },
    [onSelect, onClose]
  )

  // Cursor moves come in two flavours: from a pointer (leave focus alone) and
  // from a key (drag focus along with it).
  const moveCursor = useCallback((iso, direction = 0, fromKeyboard = false) => {
    focusPending.current = fromKeyboard
    setDir(direction)
    setCursor(iso)
  }, [])

  const claimFocus = useCallback(() => {
    const wanted = focusPending.current
    focusPending.current = false
    return wanted
  }, [])

  // The backdrop is a modal one, so Tab has nowhere legitimate to go: keep it
  // circling inside the panel rather than walking the page behind it.
  const trapTab = useCallback((e) => {
    if (e.key !== 'Tab') return
    const stops = panelRef.current?.querySelectorAll('button:not([disabled]):not([tabindex="-1"])')
    if (!stops?.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    const on = document.activeElement
    if (e.shiftKey && (on === first || on === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && on === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const showMonths = !isDay || drilled

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Tap-anywhere-else to dismiss. Above the docked action button so a
              stray tap closes the picker rather than opening the add sheet
              behind it, and below the tab bar, which stays live. */}
          <button
            type="button"
            aria-label="Close the picker"
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={isDay ? 'Pick a date' : 'Pick a month'}
            onKeyDown={trapTab}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.1 } }
                : { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.12 } }
            }
            transition={
              reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 30 }
            }
            className={[
              'absolute left-1/2 top-full z-[45] mt-2 -translate-x-1/2',
              // Narrow phones get the full gutter-to-gutter width; the cap keeps
              // it a popover rather than a slab on anything bigger.
              'w-[min(21.5rem,calc(100vw-1.5rem))]',
              'rounded-[1.5rem] border-2 border-ink-900 bg-cream-50 p-2.5 shadow-lift outline-none sm:p-3',
              // x clips the page turn sliding in; y is the last resort on a
              // sideways phone, which has ~390px of height for a ~410px panel.
              'max-h-[calc(100dvh-6.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar',
            ].join(' ')}
          >
            {showMonths ? (
              <MonthGrid
                cursor={cursor}
                moveCursor={moveCursor}
                claimFocus={claimFocus}
                value={safeValue}
                today={today}
                dir={dir}
                reduceMotion={reduceMotion}
                // Drilled in from day mode, a month is a destination in the grid,
                // not an answer: pick it and you land back on its days.
                onPick={
                  drilled
                    ? (iso) => {
                        // Hand focus to the day you land on: the label that was
                        // focused is the thing about to be replaced, and focus
                        // left on a removed node falls back to <body>, outside
                        // the panel and outside its Tab trap.
                        focusPending.current = true
                        setDir(0)
                        setCursor(withDayOf(iso, cursor, today))
                        setDrilled(false)
                      }
                    : pick
                }
                intent={drilled ? 'browse' : 'select'}
              />
            ) : (
              <DayGrid
                cursor={cursor}
                moveCursor={moveCursor}
                claimFocus={claimFocus}
                value={safeValue}
                today={today}
                dir={dir}
                reduceMotion={reduceMotion}
                onPick={pick}
                onDrillUp={() => {
                  focusPending.current = true
                  setDir(0)
                  setDrilled(true)
                }}
              />
            )}

            <button
              type="button"
              onClick={() => pick(isDay ? today : monthStart(today))}
              className="tactile mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-ink-900 bg-lime-400 font-display text-sm font-extrabold shadow-press-sm short:min-h-[38px]"
            >
              <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              {isDay ? 'Jump to today' : 'Jump to this month'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Days ─────────────────────────────────────────────────────────────────── */

function DayGrid({
  cursor,
  moveCursor,
  claimFocus,
  value,
  today,
  dir,
  reduceMotion,
  onPick,
  onDrillUp,
}) {
  const year = Number(cursor.slice(0, 4))
  const month = Number(cursor.slice(5, 7)) - 1
  const monthKey = cursor.slice(0, 7)

  // Everything the grid needs for a month, built once per month rather than per
  // render: the ISO string, the number on the face, whether it spills out of
  // the month, and the screen-reader label — 42 Intl formats is not a per-frame
  // cost worth paying.
  const { cells, canGoForward } = useMemo(() => {
    const lead = new Date(year, month, 1).getDay() // Sunday-first, matching WEEKDAYS
    const cells = Array.from({ length: GRID_CELLS }, (_, i) => {
      const d = new Date(year, month, 1 - lead + i)
      return {
        iso: toISODate(d),
        day: d.getDate(),
        outside: d.getMonth() !== month,
        label: F_DAY_FULL.format(d),
      }
    })
    return {
      cells,
      // Don't offer a month that hasn't started. The 1st of next month is the
      // cheapest thing to compare against.
      canGoForward: toISODate(new Date(year, month + 1, 1)) <= today,
    }
  }, [year, month, today])

  const gridRef = useRef(null)

  // Pull DOM focus onto the cursor cell, but only when a key put it there.
  useEffect(() => {
    if (!claimFocus()) return
    gridRef.current?.querySelector('[data-cursor="true"]')?.focus({ preventScroll: true })
  }, [cursor, claimFocus])

  // Clamped rather than blocked: End on the current week, or PageDown into a
  // month that hasn't finished, should walk up to today and stop there — a key
  // that does nothing at all reads as a broken keyboard.
  const step = (iso, direction) => moveCursor(iso > today ? today : iso, direction, true)

  const onKeyDown = (e) => {
    const keys = {
      ArrowLeft: () => step(addDays(cursor, -1), -1),
      ArrowRight: () => step(addDays(cursor, 1), 1),
      ArrowUp: () => step(addDays(cursor, -7), -1),
      ArrowDown: () => step(addDays(cursor, 7), 1),
      Home: () => step(addDays(cursor, -fromISODate(cursor).getDay()), -1),
      End: () => step(addDays(cursor, 6 - fromISODate(cursor).getDay()), 1),
      PageUp: () => step(shiftMonths(cursor, -1), -1),
      PageDown: () => step(shiftMonths(cursor, 1), 1),
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  return (
    <>
      <GridHeader
        label={F_MONTH_YEAR.format(fromISODate(cursor))}
        onLabelClick={onDrillUp}
        labelHint="Pick a month"
        onPrev={() => moveCursor(shiftMonths(cursor, -1), -1)}
        onNext={() => moveCursor(shiftMonths(cursor, 1), 1)}
        prevLabel="Previous month"
        nextLabel={canGoForward ? 'Next month' : 'Next month (hasn’t happened yet)'}
        canGoForward={canGoForward}
      />

      <div className="mt-2 grid grid-cols-7 gap-0.5 sm:gap-1" aria-hidden="true">
        {WEEKDAYS.map((day, i) => (
          <span
            key={i}
            className="flex h-6 items-center justify-center text-[0.62rem] font-extrabold uppercase text-ink-300"
          >
            {day}
          </span>
        ))}
      </div>

      <SwipeArea
        ref={gridRef}
        pageKey={monthKey}
        dir={dir}
        reduceMotion={reduceMotion}
        canGoForward={canGoForward}
        onPrev={() => moveCursor(shiftMonths(cursor, -1), -1)}
        onNext={() => moveCursor(shiftMonths(cursor, 1), 1)}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-0.5 sm:gap-1"
      >
        {cells.map((cell) => (
          <DayCell
            key={cell.iso}
            iso={cell.iso}
            day={cell.day}
            label={cell.label}
            outside={cell.outside}
            selected={cell.iso === value}
            isToday={cell.iso === today}
            isCursor={cell.iso === cursor}
            disabled={cell.iso > today}
            onPick={onPick}
          />
        ))}
      </SwipeArea>
    </>
  )
}

// Memoised because paging a month re-renders 42 of these and only a handful
// actually change: with `onPick` stable, the rest bail out on a props compare.
const DayCell = memo(function DayCell({
  iso,
  day,
  label,
  outside,
  selected,
  isToday,
  isCursor,
  disabled,
  onPick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(iso)}
      // Roving tabindex: the grid is one tab stop, the arrow keys move inside it.
      tabIndex={isCursor ? 0 : -1}
      data-cursor={isCursor || undefined}
      aria-current={selected ? 'date' : undefined}
      aria-label={label}
      className={[
        // 44px under a thumb, 40px once there's a pointer, 36px sideways where
        // six rows of 44 don't fit on the screen at all.
        'nums relative flex h-11 items-center justify-center rounded-xl border-2 font-display text-sm font-extrabold transition-colors sm:h-10 short:h-9',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-ink-300/60',
        selected
          ? 'tactile border-ink-900 bg-lime-400 text-ink-900 shadow-press-sm'
          : isToday
            ? 'border-ink-900/25 bg-cream-100 text-ink-900'
            : [
                'border-transparent hover:border-ink-900/20 hover:bg-cream-100',
                // Spill-over days stay tappable — the 31st of last month is a
                // real day — but they mustn't compete with the month you're in.
                outside ? 'text-ink-300' : 'text-ink-700',
              ].join(' '),
      ].join(' ')}
    >
      {day}
      {/* A dot marks today when today isn't the day you're looking at, so the
          calendar always says where "now" is without stealing the selection. */}
      {isToday && !selected && (
        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-lime-600" aria-hidden="true" />
      )}
    </button>
  )
})

/* ── Months ───────────────────────────────────────────────────────────────── */

function MonthGrid({
  cursor,
  moveCursor,
  claimFocus,
  value,
  today,
  dir,
  reduceMotion,
  onPick,
  intent = 'select',
}) {
  const year = Number(cursor.slice(0, 4))
  const cursorMonth = monthStart(cursor)
  const thisMonth = monthStart(today)
  const selectedMonth = monthStart(value)
  const canGoForward = `${year + 1}-01-01` <= thisMonth

  const gridRef = useRef(null)

  useEffect(() => {
    if (!claimFocus()) return
    gridRef.current?.querySelector('[data-cursor="true"]')?.focus({ preventScroll: true })
  }, [cursor, claimFocus])

  const step = (iso, direction) =>
    moveCursor(monthStart(iso) > thisMonth ? thisMonth : monthStart(iso), direction, true)

  const onKeyDown = (e) => {
    const keys = {
      ArrowLeft: () => step(shiftMonths(cursor, -1), -1),
      ArrowRight: () => step(shiftMonths(cursor, 1), 1),
      ArrowUp: () => step(shiftMonths(cursor, -3), -1),
      ArrowDown: () => step(shiftMonths(cursor, 3), 1),
      Home: () => step(`${year}-01-01`, -1),
      End: () => step(`${year}-12-01`, 1),
      PageUp: () => step(shiftMonths(cursor, -12), -1),
      PageDown: () => step(shiftMonths(cursor, 12), 1),
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  return (
    <>
      <GridHeader
        label={String(year)}
        onPrev={() => moveCursor(shiftMonths(cursor, -12), -1)}
        onNext={() => moveCursor(shiftMonths(cursor, 12), 1)}
        prevLabel="Previous year"
        nextLabel={canGoForward ? 'Next year' : 'Next year (hasn’t happened yet)'}
        canGoForward={canGoForward}
      />

      <SwipeArea
        ref={gridRef}
        pageKey={String(year)}
        dir={dir}
        reduceMotion={reduceMotion}
        canGoForward={canGoForward}
        onPrev={() => moveCursor(shiftMonths(cursor, -12), -1)}
        onNext={() => moveCursor(shiftMonths(cursor, 12), 1)}
        onKeyDown={onKeyDown}
        className="mt-2 grid grid-cols-3 gap-1.5"
      >
        {MONTH_LABELS.map((label, i) => {
          const iso = `${year}-${String(i + 1).padStart(2, '0')}-01`
          return (
            <MonthCell
              key={iso}
              iso={iso}
              label={label}
              // Drilled in from day mode the highlight tracks where you're
              // browsing; standing on its own it tracks what's actually chosen.
              selected={iso === (intent === 'browse' ? cursorMonth : selectedMonth)}
              current={iso === thisMonth}
              isCursor={iso === cursorMonth}
              disabled={iso > thisMonth}
              onPick={onPick}
            />
          )
        })}
      </SwipeArea>
    </>
  )
}

const MonthCell = memo(function MonthCell({
  iso,
  label,
  selected,
  current,
  isCursor,
  disabled,
  onPick,
}) {
  const year = iso.slice(0, 4)
  const monthIndex = Number(iso.slice(5, 7)) - 1

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(iso)}
      tabIndex={isCursor ? 0 : -1}
      data-cursor={isCursor || undefined}
      aria-current={selected ? 'date' : undefined}
      aria-label={F_MONTH_YEAR.format(new Date(Number(year), monthIndex, 1))}
      className={[
        'relative flex min-h-[48px] items-center justify-center rounded-xl border-2 font-display text-sm font-extrabold transition-colors short:min-h-[40px]',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-ink-300/60',
        selected
          ? 'tactile border-ink-900 bg-lime-400 text-ink-900 shadow-press-sm'
          : current
            ? 'border-ink-900/25 bg-cream-100 text-ink-900'
            : 'border-transparent text-ink-700 hover:border-ink-900/20 hover:bg-cream-100',
      ].join(' ')}
    >
      {label}
      {current && !selected && (
        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-lime-600" aria-hidden="true" />
      )}
    </button>
  )
})

/* ── Shared frame ─────────────────────────────────────────────────────────── */

/**
 * The grid body: a swipeable, keyboard-navigable page that slides in from the
 * direction it was moved.
 *
 * A thumb reaches for a horizontal swipe before it reaches for a 40px arrow, so
 * the gesture that pages a photo album pages a month here.
 *
 * The page turn is an entrance only — `key` remounts the grid and it slides in.
 * There's deliberately no exit half: an AnimatePresence that holds the outgoing
 * page back would mean the incoming cells don't exist yet when the caller's
 * focus effect runs, and arrow-keying across a month boundary would drop the
 * keyboard on the floor.
 */
const SwipeArea = forwardRef(function SwipeArea(
  { pageKey, dir, reduceMotion, canGoForward, onPrev, onNext, onKeyDown, className, children },
  ref
) {
  // Distance *or* flick: a slow deliberate drag and a fast short one should
  // both turn the page, which is what projecting the velocity forward buys.
  const onDragEnd = (_, info) => {
    const travel = info.offset.x + info.velocity.x * 0.12
    if (travel > SWIPE_THRESHOLD) onPrev()
    else if (travel < -SWIPE_THRESHOLD && canGoForward) onNext()
  }

  return (
    <div ref={ref} onKeyDown={onKeyDown}>
      <motion.div
        key={pageKey}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 26 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0.08 : 0.16, ease: 'easeOut' }}
        // Vertical scrolling still belongs to the page; only the x axis is ours.
        style={{ touchAction: 'pan-y' }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  )
})

function GridHeader({
  label,
  onLabelClick,
  labelHint,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  canGoForward,
}) {
  return (
    <div className="flex items-center gap-2">
      <ArrowButton icon={ChevronLeft} label={prevLabel} onClick={onPrev} />

      {onLabelClick ? (
        <button
          type="button"
          onClick={onLabelClick}
          aria-label={`${label}. ${labelHint}`}
          title={labelHint}
          className="min-w-0 flex-1 truncate rounded-xl px-2 py-2 text-center font-display text-base font-extrabold tracking-tight transition-colors hover:bg-cream-200"
        >
          {label}
        </button>
      ) : (
        <span
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-center font-display text-base font-extrabold tracking-tight"
        >
          {label}
        </span>
      )}

      <ArrowButton icon={ChevronRight} label={nextLabel} onClick={onNext} disabled={!canGoForward} />
    </div>
  )
}

function ArrowButton({ icon: Icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="tactile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-y-0 sm:h-10 sm:w-10 short:h-9 short:w-9"
    >
      <Icon className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
    </button>
  )
}
