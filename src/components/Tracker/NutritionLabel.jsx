import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ProgressBar from '../shared/ProgressBar'
import Icon3D from '../shared/Icon3D'
import {
  MACROS,
  MACRO_META,
  clampedRatio,
  formatNumber,
  goalStatus,
  macroSplit,
  round0,
} from '../../utils/nutritionMath'

/**
 * "Today's progress" — the card the whole app is built around.
 *
 * Deliberately *not* an FDA nutrition label: a 270° calorie arc carries the one
 * number that matters (what's left), three linear bars carry the macros, and
 * the fibre/sugar/sodium detail is demoted to a footer strip. Colour does the
 * talking — lime while there's room, coral once you're over.
 *
 * (Filename kept from the original spec; the layout is the progress card.)
 */

const RADIUS = 80
const STROKE = 17
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC = 0.75 // 270° of sweep, opening at the bottom

export default function NutritionLabel({ totals, goals, loading = false, entryCount = 0 }) {
  const calorieStatus = goalStatus(totals.calories, goals.calories)
  const isOver = calorieStatus === 'over'
  const left = round0(goals.calories - totals.calories)
  const progress = clampedRatio(totals.calories, goals.calories)
  const split = macroSplit(totals)

  const celebrating = useCelebration(calorieStatus)

  if (loading) return <ProgressCardSkeleton />

  return (
    <section
      className="card-stacked"
      aria-label={`Progress for the day: ${round0(totals.calories)} of ${goals.calories} calories`}
    >
      <div className="card overflow-hidden p-5 pb-4">
        {/* ── Arc ───────────────────────────────────────────────────────
            Sized in percentages off a square box rather than pinned at 212px:
            a 280px-wide foldable has less room inside the card padding than
            that, and a fixed ring would have been clipped by the card's own
            overflow-hidden. It gains a little back on a desktop column. */}
        <div className="relative mx-auto w-full max-w-[212px] lg:max-w-[236px]">
          <svg viewBox="0 0 200 200" className="aspect-square w-full -rotate-[135deg]">
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke="rgb(var(--c-cream-200))"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${ARC * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            />
            <motion.circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke={isOver ? '#FF5A38' : '#C6F32B'}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${ARC * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              initial={false}
              animate={{ strokeDashoffset: (1 - progress) * ARC * CIRCUMFERENCE }}
              transition={{ type: 'spring', stiffness: 90, damping: 20 }}
              style={{ filter: 'drop-shadow(0 3px 0 var(--shadow-drop))' }}
            />
          </svg>

          {/* Centre readout */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pb-2 text-center"
            animate={celebrating ? { scale: [1, 1.12, 0.97, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <span className="label-caps">{isOver ? 'over by' : 'still to eat'}</span>
            <span
              className={`nums font-display text-hero ${isOver ? 'text-coral-500' : 'text-ink-900'}`}
            >
              {formatNumber(Math.abs(left))}
            </span>
            <span className="mt-1 text-xs font-bold text-ink-400">
              of {formatNumber(goals.calories)} kcal
            </span>
          </motion.div>

          <AnimatePresence>
            {celebrating && (
              <motion.div
                className="pointer-events-none absolute -right-1 -top-1"
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14 }}
              >
                <Icon3D name="party" size={46} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Eaten / burned-through summary ──────────────────────────── */}
        <div className="mx-auto -mt-3 mb-5 flex w-full max-w-[280px] items-center justify-center gap-2">
          <Chip label="eaten" value={`${formatNumber(totals.calories)}`} tone="ink" />
          <span className="h-6 w-px bg-ink-900/10" />
          <Chip
            label={isOver ? 'over budget' : 'of goal'}
            value={`${Math.round(clampedRatio(totals.calories, goals.calories) * 100)}%`}
            tone={isOver ? 'coral' : 'lime'}
          />
        </div>

        {/* ── Macros ──────────────────────────────────────────────────── */}
        <div className="space-y-3.5">
          {MACROS.map((macro) => (
            <div key={macro} className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink-900/20"
                style={{ background: MACRO_META[macro].ring }}
                aria-hidden="true"
              />
              <ProgressBar
                label={MACRO_META[macro].label}
                value={totals[macro]}
                goal={goals[macro]}
                color={MACRO_META[macro].ring}
                track={MACRO_META[macro].track}
                celebrate
              />
            </div>
          ))}
        </div>

        {/* ── Detail strip: real numbers, demoted, not hidden ──────────── */}
        {entryCount > 0 && (
          <div className="mt-5 flex items-stretch gap-2 rounded-2xl border-2 border-ink-900/10 bg-cream-100 p-2.5">
            <Detail label="Fibre" value={`${round0(totals.fiber)}g`} />
            <Detail label="Sugar" value={`${round0(totals.sugar)}g`} />
            <Detail label="Sodium" value={`${formatNumber(totals.sodium)}mg`} />
            <Detail
              label="Split"
              value={`${split.protein}/${split.carbs}/${split.fat}`}
              title="Share of energy from protein / carbs / fat"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function Chip({ label, value, tone }) {
  const tones = {
    ink: 'text-ink-900',
    lime: 'text-lime-700',
    coral: 'text-coral-600',
  }
  return (
    <div className="px-2 text-center">
      <div className={`nums font-display text-lg font-extrabold leading-none ${tones[tone]}`}>
        {value}
      </div>
      <div className="label-caps mt-1">{label}</div>
    </div>
  )
}

function Detail({ label, value, title }) {
  return (
    <div className="flex-1 text-center" title={title}>
      <div className="nums font-display text-[0.8rem] font-extrabold leading-none text-ink-700">
        {value}
      </div>
      <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-ink-400">
        {label}
      </div>
    </div>
  )
}

/**
 * Fires a one-shot celebration when the calorie total *enters* the on-target
 * band. Tracks the previous status so it doesn't re-fire on every re-render,
 * and stays quiet on first mount — landing on the page already at goal isn't
 * an achievement that just happened.
 */
function useCelebration(status) {
  const [celebrating, setCelebrating] = useState(false)
  const previous = useRef(null)

  useEffect(() => {
    const wasKnown = previous.current !== null
    const justHit = wasKnown && previous.current !== 'hit' && status === 'hit'
    previous.current = status

    if (!justHit) return
    setCelebrating(true)
    const timer = setTimeout(() => setCelebrating(false), 1600)
    return () => clearTimeout(timer)
  }, [status])

  return celebrating
}

function ProgressCardSkeleton() {
  return (
    <section className="card-stacked" aria-busy="true" aria-label="Loading today’s progress">
      <div className="card p-5">
        <div className="skeleton mx-auto aspect-square w-full max-w-[212px] rounded-full lg:max-w-[236px]" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-full rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
