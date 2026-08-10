import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import LogEntryRow from './LogEntryRow'
import Icon3D from '../shared/Icon3D'
import Button from '../shared/Button'
import { formatNumber } from '../../utils/nutritionMath'
import { isToday } from '../../utils/dateHelpers'

/**
 * The day's food, oldest first — the order you ate it in, which is the order
 * people remember it in.
 */
export default function FoodLog({ entries, totals, loading, error, date, onDelete, onRetry, onAdd }) {
  return (
    <section aria-label="Food log">
      <header className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          {isToday(date) ? 'Eaten today' : 'Eaten that day'}
        </h2>
        {entries.length > 0 && (
          <p className="nums text-xs font-bold text-ink-400">
            {entries.length} {entries.length === 1 ? 'item' : 'items'} ·{' '}
            {formatNumber(totals.calories)} kcal
          </p>
        )}
      </header>

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
        <LogSkeleton />
      ) : entries.length === 0 && !error ? (
        <EmptyState date={date} onAdd={onAdd} />
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {entries.map((entry, index) => (
              <LogEntryRow key={entry.id} entry={entry} index={index} onDelete={onDelete} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}

function EmptyState({ date, onAdd }) {
  const today = isToday(date)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center px-6 py-10 text-center"
    >
      <Icon3D name={today ? 'plate' : 'moon'} size={82} float={today} className="mb-4" />

      <p className="font-display text-lg font-extrabold leading-tight">
        {today ? 'Nothing logged yet' : 'This day stayed empty'}
      </p>
      <p className="mx-auto mt-2 max-w-[17rem] text-sm font-medium leading-relaxed text-ink-400">
        {today
          ? 'Search below to add your first bite — a coffee counts.'
          : 'No food was logged on this date. You can still add it retroactively — or head back to today.'}
      </p>

      {today && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onAdd}>
          Log something
        </Button>
      )}
    </motion.div>
  )
}

function LogSkeleton() {
  return (
    <ul className="space-y-2.5" aria-busy="true" aria-label="Loading food log">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3"
        >
          <div className="skeleton h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-2.5 w-3/4" />
          </div>
          <div className="skeleton h-6 w-10" />
        </li>
      ))}
    </ul>
  )
}
