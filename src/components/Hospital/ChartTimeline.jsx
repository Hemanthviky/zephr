import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import Button from '../shared/Button'
import { describeLog } from '../../data/hospitalItems'
import { isToday } from '../../utils/dateHelpers'
import {
  clockParts,
  formatDose,
  formatMl,
  groupByBand,
  runningTotals,
  sumMl,
} from '../../utils/hospitalMath'

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'drink', label: 'Fluids' },
  { id: 'med', label: 'Medicines' },
]

/**
 * The chart itself: one day, top to bottom, in the order it happened.
 *
 * Fluids and medicines share a single rail rather than living in two lists.
 * "She drank 200ml at 2, and the tablet went in at 2:15" is one sentence about
 * one afternoon, and two separate logs make you reconstruct it every time.
 * Colour and the left edge of each card carry the difference instead.
 *
 * Every drink row also carries the running total it produced — the number a
 * fluid chart is actually kept for is cumulative, not any single cup.
 */
export default function ChartTimeline({
  rows,
  loading,
  error,
  date,
  onEdit,
  onDelete,
  onRetry,
  onAdd,
}) {
  const [filter, setFilter] = useState('all')

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.kind === filter)),
    [rows, filter]
  )
  // Computed from every drink of the day, not just the visible ones, so
  // filtering to Fluids and back never changes what a row says it added up to.
  const cumulative = useMemo(() => runningTotals(rows), [rows])
  const sections = useMemo(() => groupByBand(visible), [visible])

  return (
    <section aria-label="Intake chart">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          {isToday(date) ? 'Today’s chart' : 'That day’s chart'}
        </h2>
        {rows.length > 0 && (
          <p className="nums text-xs font-bold text-ink-400">
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · {formatMl(sumMl(rows))} ml
          </p>
        )}
      </header>

      {/* Three chips that split the row evenly rather than wrapping: at 320px
          the natural widths ("Everything 12", "Medicines 4") spill onto a
          second line, and a filter bar that changes height as you log things
          makes the list below it jump. */}
      <div className="mb-4 flex gap-1.5 px-1">
        {FILTERS.map((option) => {
          const active = filter === option.id
          const count =
            option.id === 'all' ? rows.length : rows.filter((row) => row.kind === option.id).length
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={active}
              className={[
                'tactile inline-flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill border-2 px-2 text-xs font-extrabold transition-colors sm:flex-none sm:px-3.5',
                active
                  ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                  : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/40',
              ].join(' ')}
            >
              <span className="truncate">{option.label}</span>
              <span className={`nums shrink-0 ${active ? 'text-ink-700' : 'text-ink-300'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-coral-600" strokeWidth={2.75} />
          <p className="min-w-0 flex-1 text-sm font-semibold text-coral-600">{error}</p>
          <Button size="xs" variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <ChartSkeleton />
      ) : visible.length === 0 && !error ? (
        <EmptyState date={date} filter={filter} onAdd={onAdd} />
      ) : (
        <div className="space-y-6">
          {sections.map(({ band, rows: bandRows }) => (
            <section key={band.id} aria-label={band.label}>
              <header className="mb-2 flex items-center gap-2 px-1">
                <Icon3D name={band.icon} size={24} />
                <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.12em]">
                  {band.label}
                </h3>
                <span className="h-px flex-1 bg-ink-900/10" aria-hidden="true" />
                <span className="nums shrink-0 text-xs font-extrabold text-ink-400">
                  {formatMl(sumMl(bandRows))} ml
                </span>
              </header>

              {/* The rail. One hairline behind every row in the band, which is
                  what makes a stack of cards read as a chart. It sits in the
                  gap between the two columns, so it moves with them when the
                  gutter narrows on a phone. */}
              <ul className="relative space-y-2.5">
                <span
                  className="absolute bottom-4 left-[49px] top-4 w-[2px] rounded-pill bg-ink-900/10 sm:left-[61px]"
                  aria-hidden="true"
                />
                <AnimatePresence initial={false} mode="popLayout">
                  {bandRows.map((row, index) => (
                    <ChartRow
                      key={row.id}
                      row={row}
                      index={index}
                      total={cumulative[row.id]}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * One observation.
 *
 * Sized for a phone first, because that's where a chart gets filled in — beside
 * a bed, one-handed. Three things bought the width back:
 *
 *  • the time gutter stacks '8:42' over 'pm' and narrows to 40px;
 *  • the row *is* the edit button, so the only icon competing with the text is
 *    delete. Two 40px icon buttons on a 360px screen left about 100px for the
 *    name of the drink, which is not a row, it's an ellipsis;
 *  • the amount moved out of the truncating meta line onto its own baseline,
 *    where "200 ml · 1,050 so far" survives at any width.
 *
 * Delete stays a separate target and is confirmed inline on the row, the same
 * two-tap pattern the food log uses — a modal for "remove one cup of water" is
 * far too much ceremony, and a one-tap trash deletes things people meant to keep.
 *
 * forwardRef because the band around it is an `AnimatePresence
 * mode="popLayout"`: it measures each leaving row through a ref on the direct
 * child, and a plain function component swallows that ref.
 */
const ChartRow = forwardRef(function ChartRow({ row, index, total, onEdit, onDelete }, ref) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { icon, tint } = describeLog(row)
  const isMed = row.kind === 'med'
  const isPending = String(row.id).startsWith('optimistic-')
  const { time, suffix } = clockParts(row.at)

  async function handleDelete() {
    setDeleting(true)
    const ok = await onDelete(row.id)
    if (!ok) {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -50, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(index * 0.03, 0.2) }}
      className="relative grid grid-cols-[40px_minmax(0,1fr)] items-start gap-[18px] sm:grid-cols-[54px_minmax(0,1fr)] sm:gap-4"
    >
      {/* Time gutter — the left column of every chart ever printed. */}
      <div className="pt-2.5 text-right sm:pt-3">
        <p className="nums font-display text-[0.8rem] font-extrabold leading-none sm:text-sm">
          {time}
        </p>
        {suffix && (
          <p className="mt-0.5 text-[0.55rem] font-extrabold uppercase tracking-[0.1em] text-ink-400">
            {suffix}
          </p>
        )}
        {isMed && (
          <p className="mt-1 text-[0.55rem] font-extrabold uppercase tracking-[0.1em] text-ink-300">
            dose
          </p>
        )}
      </div>

      {/* The node, sitting on the rail between the two columns. */}
      <span
        className="absolute left-[43px] top-[17px] h-3.5 w-3.5 rounded-full border-2 border-ink-900 sm:left-[55px] sm:top-[18px]"
        style={{ background: tint }}
        aria-hidden="true"
      />

      <div
        className="relative flex overflow-hidden rounded-2xl border-2 border-l-[6px] border-ink-900/10 bg-cream-50 shadow-card"
        style={{ borderLeftColor: tint }}
      >
        {/* The whole row opens the editor. On a phone that's a 260px target for
            the thing people come back to change — the time they typed in a
            hurry — instead of a 40px pencil next to a 40px bin. */}
        <button
          type="button"
          onClick={() => onEdit(row)}
          disabled={isPending}
          aria-label={`Edit ${row.name}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5 text-left transition-colors hover:bg-cream-100 disabled:opacity-60"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900/10"
            style={{ background: `${tint}1f` }}
            aria-hidden="true"
          >
            <Icon3D name={icon} size={24} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate font-display text-[0.95rem] font-extrabold leading-tight">
                {row.name}
              </span>
              <Pencil
                className="h-3.5 w-3.5 shrink-0 text-ink-300"
                strokeWidth={3}
                aria-hidden="true"
              />
            </span>

            {/* Amount on its own baseline: it's the number the chart exists for,
                and it was the first thing to disappear when the name was long. */}
            <span className="nums mt-0.5 block truncate text-xs font-extrabold text-ink-700">
              {isMed ? formatDose(row.amount, row.unit) : `${formatMl(row.amount)} ml`}
              {!isMed && Number.isFinite(total) && (
                <span className="font-semibold text-ink-400"> · {formatMl(total)} so far</span>
              )}
            </span>

            {row.note && (
              <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-ink-400">
                {row.note}
              </span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          aria-label={`Delete ${row.name}`}
          className="flex w-11 shrink-0 items-center justify-center self-stretch border-l-2 border-ink-900/10 text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.75} />
        </button>

        {confirming && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-0 flex items-center justify-between gap-2 bg-coral-100 px-3"
          >
            <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-coral-600">
              Take it off the chart?
            </p>
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
              aria-label={`Confirm delete ${row.name}`}
              className="tactile flex h-11 min-w-[64px] items-center justify-center gap-1 rounded-xl border-2 border-ink-900 bg-coral-500 px-3 font-display text-sm font-extrabold text-cream-50 shadow-press-coral"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              Yes
            </button>
          </motion.div>
        )}
      </div>
    </motion.li>
  )
})

function EmptyState({ date, filter, onAdd }) {
  const today = isToday(date)
  const med = filter === 'med'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center px-6 py-10 text-center"
    >
      <Icon3D name={med ? 'pill' : today ? 'droplet' : 'clipboard'} size={78} float={today} className="mb-4" />

      <p className="font-display text-lg font-extrabold leading-tight">
        {med ? 'No medicine on this chart' : today ? 'Chart’s still blank' : 'Nothing was charted'}
      </p>
      <p className="mx-auto mt-2 max-w-[18rem] text-sm font-medium leading-relaxed text-ink-400">
        {today
          ? med
            ? 'Log each dose as it goes in — the time fills itself.'
            : 'Log the first cup and the running total starts here.'
          : 'You can still fill this day in — the time is yours to set.'}
      </p>

      <Button
        variant="secondary"
        size="sm"
        className="mt-5"
        onClick={() => onAdd(med ? 'med' : 'drink')}
      >
        {med ? 'Log a medicine' : 'Log a drink'}
      </Button>
    </motion.div>
  )
}

function ChartSkeleton() {
  return (
    <ul className="space-y-2.5" aria-busy="true" aria-label="Loading the chart">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-[18px] sm:grid-cols-[54px_minmax(0,1fr)] sm:gap-4"
        >
          <div className="skeleton mt-3 h-3 w-full" />
          <div className="flex items-center gap-2.5 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-2.5">
            <div className="skeleton h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-1/2" />
              <div className="skeleton h-2.5 w-3/4" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
