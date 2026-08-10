import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconButton } from '../shared/Button'
import PeriodPicker from '../shared/PeriodPicker'
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
 *
 * Tapping the label opens the same PeriodPicker the Food tab uses, in its
 * month mode: a year at a time, so last March is one tap rather than five.
 */
export default function MonthNav({ month, onChange, transactionCount = 0 }) {
  const nextMonth = addMonths(month, 1)
  const viewingNow = isCurrentMonth(month)
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <IconButton
          icon={ChevronLeft}
          label="Previous month"
          onClick={() => onChange(addMonths(month, -1))}
        />

        {/* Same construction as DateNav: heading outside, phrasing content in. */}
        <h1 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-label={`${formatMonthLabel(month, { short: true })}. Pick a different month`}
            className={[
              'w-full rounded-2xl px-2 py-1 text-center transition-colors',
              pickerOpen ? 'bg-cream-200' : 'hover:bg-cream-200/70',
            ].join(' ')}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={month}
                className="block"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
              >
                <span className="block truncate font-display text-2xl font-extrabold leading-none tracking-tight">
                  {formatMonthLabel(month)}
                </span>
                <span className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-ink-400">
                  <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />
                  <span className="truncate">
                    {formatMonthLabel(month, { short: true })} ·{' '}
                    {transactionCount === 1 ? '1 entry' : `${transactionCount} entries`}
                  </span>
                </span>
              </motion.span>
            </AnimatePresence>
          </button>
        </h1>

        <IconButton
          icon={ChevronRight}
          label={isFutureMonth(nextMonth) ? 'Next month (hasn’t happened yet)' : 'Next month'}
          disabled={isFutureMonth(nextMonth)}
          onClick={() => onChange(nextMonth)}
        />
      </div>

      <PeriodPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="month"
        value={month}
        onSelect={onChange}
      />

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
