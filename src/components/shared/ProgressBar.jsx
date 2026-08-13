import { motion } from 'framer-motion'
import { round0, clampedRatio, ratio, goalStatus } from '../../utils/nutritionMath'

/**
 * A macro bar: label, eaten/goal, and a chunky track.
 *
 * Over budget doesn't just clamp at 100% — the bar turns coral and a striped
 * overflow segment grows from the right, so "20g over" and "exactly on target"
 * never look identical.
 */
export default function ProgressBar({
  label,
  value = 0,
  goal = 0,
  color = 'rgb(var(--c-coral-500))',
  // coral-100 — a pale blush in daylight, a deep stain of the same hue after
  // dark. Both read as "the empty part of the bar", which is the job.
  track = 'rgb(var(--c-coral-100))',
  unit = 'g',
  celebrate = false,
}) {
  const status = goalStatus(value, goal)
  const filled = clampedRatio(value, goal)
  const overflow = Math.min(1, Math.max(0, ratio(value, goal) - 1))
  const isOver = status === 'over'

  return (
    <div className="flex-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-1">
        <span className="font-display text-xs font-extrabold uppercase tracking-wider text-ink-500">
          {label}
        </span>
        <span className="nums font-display text-xs font-extrabold text-ink-700">
          {round0(value)}
          <span className="font-sans font-bold text-ink-300">/{round0(goal)}{unit}</span>
        </span>
      </div>

      <div
        className="relative h-3 w-full overflow-hidden rounded-pill border-2 border-ink-900/10"
        style={{ background: track }}
        role="progressbar"
        aria-label={`${label}: ${round0(value)} of ${round0(goal)} ${unit}`}
        aria-valuenow={round0(value)}
        aria-valuemin={0}
        aria-valuemax={round0(goal)}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-pill"
          style={{ background: isOver ? '#FF5A38' : color }}
          initial={false}
          animate={{ width: `${filled * 100}%` }}
          transition={{ type: 'spring', stiffness: 210, damping: 26 }}
        />

        {isOver && (
          <motion.div
            className="absolute inset-y-0 right-0 rounded-r-pill"
            style={{
              background:
                'repeating-linear-gradient(45deg, #B32E13 0 5px, #E33E1C 5px 10px)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(overflow, 0.06) * 100}%` }}
            transition={{ type: 'spring', stiffness: 210, damping: 26 }}
          />
        )}
      </div>

      {/* The little celebratory tick when a macro lands in the target band. */}
      {celebrate && status === 'hit' && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-[0.7rem] font-extrabold text-lime-700"
        >
          nailed it
        </motion.p>
      )}
    </div>
  )
}
