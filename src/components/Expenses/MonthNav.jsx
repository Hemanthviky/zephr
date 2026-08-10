import { ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconButton } from '../shared/Button'
import {
  addMonths,
  currentMonth,
  formatMonthLabel,
  isCurrentMonth,
  isFutureMonth,
} from '../../utils/expenseMath'

/**
 * Month switcher — the Money module's answer to DateNav, deliberately built to
 * the same shape: two arrows, the label between them, and a "back to now"
 * escape hatch that only appears when you've wandered off.
 */
export default function MonthNav({ month, onChange, transactionCount = 0 }) {
  const nextMonth = addMonths(month, 1)
  const viewingNow = isCurrentMonth(month)

  return (
    <div>
      <div className="flex items-center gap-3">
        <IconButton
          icon={ChevronLeft}
          label="Previous month"
          onClick={() => onChange(addMonths(month, -1))}
        />

        <div className="min-w-0 flex-1 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <h1 className="truncate font-display text-2xl font-extrabold leading-none tracking-tight">
                {formatMonthLabel(month)}
              </h1>
              <p className="mt-1 truncate text-xs font-bold text-ink-400">
                {formatMonthLabel(month, { short: true })} ·{' '}
                {transactionCount === 1 ? '1 entry' : `${transactionCount} entries`}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <IconButton
          icon={ChevronRight}
          label={isFutureMonth(nextMonth) ? 'Next month (hasn’t happened yet)' : 'Next month'}
          disabled={isFutureMonth(nextMonth)}
          onClick={() => onChange(nextMonth)}
        />
      </div>

      <AnimatePresence>
        {!viewingNow && (
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <button
              type="button"
              onClick={() => onChange(currentMonth())}
              className="tactile mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-ink-900 bg-lime-400 px-3.5 text-xs font-extrabold shadow-press-sm"
            >
              <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              Back to this month
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
