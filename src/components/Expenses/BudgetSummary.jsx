import { motion } from 'framer-motion'
import ProgressBar from '../shared/ProgressBar'
import Icon3D from '../shared/Icon3D'
import {
  budgetSummary,
  formatMoney,
  monthProgress,
  isCurrentMonth,
} from '../../utils/expenseMath'
import { round0 } from '../../utils/nutritionMath'

/**
 * "Remaining this month" — the Money module's hero card.
 *
 * Same visual grammar as the food tracker's progress card, on purpose: a 270°
 * arc carrying the one number that matters, linear bars underneath for the
 * breakdown, a demoted detail strip at the bottom. Only the labels change.
 *
 * Three modes, driven by what the user has actually set up:
 *   budget — category budgets exist, so the arc is spent ÷ budget
 *   income — no budgets, but income logged: arc is spent ÷ income
 *   none   — neither, so there's nothing to divide by; show the raw spend
 */

const RADIUS = 80
const STROKE = 17
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC = 0.75

export default function BudgetSummary({
  transactions,
  budgets,
  categories,
  categoryTotals,
  month,
  loading = false,
}) {
  const summary = budgetSummary(transactions, budgets)

  if (loading) return <BudgetSummarySkeleton />

  const hasLimit = summary.mode !== 'none'
  const over = summary.over
  // Ahead of schedule = you've burned less of the budget than of the month.
  const pace = monthProgress(month)
  const onPace = hasLimit && !over && summary.progress <= pace + 0.03
  const live = isCurrentMonth(month)

  const headline = hasLimit ? Math.abs(round0(summary.remaining)) : round0(summary.spent)
  const caption = !hasLimit ? 'spent so far' : over ? 'over budget' : 'left to spend'

  // Only the three biggest categories get a bar — a nine-bar wall of colour is
  // a chart, and the chart is right below this card.
  const topCategories = categoryTotals.slice(0, 3)

  return (
    <section
      className="card-stacked"
      aria-label={`Money for the month: ${formatMoney(summary.spent)} spent`}
    >
      <div className="card overflow-hidden p-5 pb-4">
        {/* Percentage-sized, for the same reason as the food tracker's ring:
            it has to survive a 280px screen and it may as well use a desktop
            column when there is one. */}
        <div className="relative mx-auto w-full max-w-[212px] lg:max-w-[236px]">
          <svg viewBox="0 0 200 200" className="aspect-square w-full -rotate-[135deg]">
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke="#F7EDD8"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${ARC * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            />
            <motion.circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke={over ? '#FF5A38' : '#C6F32B'}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${ARC * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              initial={false}
              animate={{
                strokeDashoffset: (1 - (hasLimit ? summary.progress : 0)) * ARC * CIRCUMFERENCE,
              }}
              transition={{ type: 'spring', stiffness: 90, damping: 20 }}
              style={{ filter: 'drop-shadow(0 3px 0 rgba(27,25,21,0.14))' }}
            />

            {/* Where you *should* be by today, if spending evenly. */}
            {hasLimit && live && (
              <line
                x1="100"
                y1="100"
                x2="100"
                y2={100 - RADIUS - STROKE / 2 - 2}
                stroke="#1B1915"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.35"
                transform={`rotate(${pace * ARC * 360} 100 100)`}
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pb-2 text-center">
            <span className="label-caps">{caption}</span>
            {/* text-money / -long carry their own leading, tracking and weight,
                and both clamp against the viewport so a six-figure total
                doesn't run out of ring on a small phone. */}
            <span
              className={`nums font-display ${over ? 'text-coral-500' : 'text-ink-900'} ${
                headline >= 100000 ? 'text-money-long' : 'text-money'
              }`}
            >
              {formatMoney(headline)}
            </span>
            <span className="mt-1 px-6 text-[0.7rem] font-bold leading-tight text-ink-400">
              {hasLimit
                ? `of ${formatMoney(summary.limit)} ${summary.mode === 'budget' ? 'budgeted' : 'earned'}`
                : 'no budget set yet'}
            </span>
          </div>

          {onPace && live && (
            <motion.div
              className="pointer-events-none absolute -right-1 -top-1"
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 15, delay: 0.25 }}
            >
              <Icon3D name="sparkles" size={40} />
            </motion.div>
          )}
        </div>

        {/* Spent / in / net */}
        <div className="mx-auto -mt-3 mb-5 flex w-full max-w-[320px] items-center justify-center gap-1">
          <Chip label="spent" value={formatMoney(summary.spent, { compact: true })} tone="ink" />
          <span className="h-6 w-px bg-ink-900/10" />
          <Chip label="income" value={formatMoney(summary.income, { compact: true })} tone="lime" />
          <span className="h-6 w-px bg-ink-900/10" />
          <Chip
            label="net"
            value={formatMoney(summary.net, { compact: true, sign: true })}
            tone={summary.net < 0 ? 'coral' : 'lime'}
          />
        </div>

        {/* Top categories, as the macro bars' direct counterpart */}
        {topCategories.length > 0 ? (
          <div className="space-y-3.5">
            {topCategories.map((category) => (
              <div key={category.id} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink-900/20"
                  style={{ background: category.color }}
                  aria-hidden="true"
                />
                <ProgressBar
                  label={category.name}
                  value={category.total}
                  // With no budget for a category, the biggest spend sets the
                  // scale, so the bars still compare against each other.
                  goal={category.budget || categoryTotals[0].total}
                  color={category.color}
                  track="#F7EDD8"
                  unit=""
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink-900/15 p-3.5">
            <Icon3D name="moneybag" size={34} />
            <p className="text-sm font-semibold leading-snug text-ink-400">
              Nothing spent this month yet. Add one and the breakdown fills in.
            </p>
          </div>
        )}

        {/* Detail strip */}
        {transactions.length > 0 && (
          <div className="mt-5 flex items-stretch gap-2 rounded-2xl border-2 border-ink-900/10 bg-cream-100 p-2.5">
            <Detail label="Entries" value={String(transactions.length)} />
            <Detail label="Categories" value={String(categoryTotals.length)} />
            <Detail
              label="Avg / day"
              value={formatMoney(
                summary.spent / Math.max(1, Math.round(pace * daysInMonth(month))),
                { compact: true }
              )}
              title="Spent so far, divided by days elapsed this month"
            />
            <Detail
              label="Biggest"
              value={categoryTotals[0] ? shorten(categoryTotals[0].name) : '—'}
              title={categoryTotals[0]?.name}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m, 0).getDate()
}

function shorten(name) {
  const first = name.split(/[\s&]+/)[0]
  return first.length > 9 ? `${first.slice(0, 8)}…` : first
}

function Chip({ label, value, tone }) {
  const tones = { ink: 'text-ink-900', lime: 'text-lime-700', coral: 'text-coral-600' }
  return (
    <div className="min-w-0 flex-1 px-1 text-center">
      <div className={`nums truncate font-display text-base font-extrabold leading-none ${tones[tone]}`}>
        {value}
      </div>
      <div className="label-caps mt-1">{label}</div>
    </div>
  )
}

function Detail({ label, value, title }) {
  return (
    <div className="min-w-0 flex-1 text-center" title={title}>
      <div className="nums truncate font-display text-[0.8rem] font-extrabold leading-none text-ink-700">
        {value}
      </div>
      <div className="mt-1 truncate text-[0.6rem] font-bold uppercase tracking-wider text-ink-400">
        {label}
      </div>
    </div>
  )
}

function BudgetSummarySkeleton() {
  return (
    <section className="card-stacked" aria-busy="true" aria-label="Loading this month">
      <div className="card p-5">
        <div className="skeleton mx-auto aspect-square w-full max-w-[212px] rounded-full lg:max-w-[236px]" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-3 w-full rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
