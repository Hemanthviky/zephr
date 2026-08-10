import { ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconButton } from '../shared/Button'
import {
  addDays,
  formatDayLabel,
  formatFullDate,
  isFuture,
  isToday,
  todayISO,
} from '../../utils/dateHelpers'

/**
 * Day switcher. The forward arrow is disabled on today — you can't log food you
 * haven't eaten yet, and an enabled-but-always-empty tomorrow is a dead end.
 *
 * Only three controls sit in the row (48px each, comfortably thumb-sized); the
 * "back to today" escape hatch appears underneath, and only when it's useful.
 */
export default function DateNav({ date, onChange, entryCount = 0 }) {
  const nextDay = addDays(date, 1)
  const viewingToday = isToday(date)

  return (
    <div>
      <div className="flex items-center gap-3">
        <IconButton
          icon={ChevronLeft}
          label="Previous day"
          onClick={() => onChange(addDays(date, -1))}
        />

        <div className="min-w-0 flex-1 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <h1 className="truncate font-display text-2xl font-extrabold leading-none tracking-tight">
                {formatDayLabel(date)}
              </h1>
              <p className="mt-1 truncate text-xs font-bold text-ink-400">
                {viewingToday
                  ? formatFullDate(date)
                  : `${formatFullDate(date)} · ${entryCount} logged`}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <IconButton
          icon={ChevronRight}
          label={viewingToday ? 'Next day (nothing here yet)' : 'Next day'}
          disabled={isFuture(nextDay)}
          onClick={() => onChange(nextDay)}
        />
      </div>

      <AnimatePresence>
        {!viewingToday && (
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <button
              type="button"
              onClick={() => onChange(todayISO())}
              className="tactile mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-ink-900 bg-lime-400 px-3.5 text-xs font-extrabold shadow-press-sm"
            >
              <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              Back to today
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
