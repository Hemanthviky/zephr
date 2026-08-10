import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconButton } from '../shared/Button'
import PeriodPicker from '../shared/PeriodPicker'
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
 *
 * The label between the arrows is itself the button for a calendar. Arrows are
 * right for yesterday and wrong for the 3rd of last month, which is nine taps
 * away — so the same row does both, and the Money tab's month navigator does
 * the identical thing with the identical picker.
 */
export default function DateNav({ date, onChange, entryCount = 0 }) {
  const nextDay = addDays(date, 1)
  const viewingToday = isToday(date)
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <IconButton
          icon={ChevronLeft}
          label="Previous day"
          onClick={() => onChange(addDays(date, -1))}
        />

        {/* The heading wraps the button rather than sitting inside it: a
            <button> may only contain phrasing content, so the two lines are
            spans and the h1 stays on the outside where it's still the page's
            heading on a phone. */}
        <h1 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-label={`${formatFullDate(date)}. Pick a different date`}
            className={[
              'w-full rounded-2xl px-2 py-1 text-center transition-colors',
              pickerOpen ? 'bg-cream-200' : 'hover:bg-cream-200/70',
            ].join(' ')}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={date}
                className="block"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
              >
                <span className="block truncate font-display text-2xl font-extrabold leading-none tracking-tight">
                  {formatDayLabel(date)}
                </span>
                <span className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-ink-400">
                  <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />
                  <span className="truncate">
                    {viewingToday
                      ? formatFullDate(date)
                      : `${formatFullDate(date)} · ${entryCount} logged`}
                  </span>
                </span>
              </motion.span>
            </AnimatePresence>
          </button>
        </h1>

        <IconButton
          icon={ChevronRight}
          label={viewingToday ? 'Next day (nothing here yet)' : 'Next day'}
          disabled={isFuture(nextDay)}
          onClick={() => onChange(nextDay)}
        />
      </div>

      <PeriodPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="day"
        value={date}
        onSelect={onChange}
      />

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
