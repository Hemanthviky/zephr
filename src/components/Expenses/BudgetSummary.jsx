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
 * This used to be the food tracker's progress card with different labels: the
 * same 270° arc, the same 212px ring. It looked consistent and read wrong. A
 * calorie goal resets every morning, so a dial that empties and refills is
 * exactly right for it. A budget doesn't reset — it's drawn down across a month
 * that is itself running out, and the question is never just "how much is
 * left", it's "how much is left *and how far through the month am I*". Two
 * quantities racing each other is a bar with two positions on it, not a ring
 * with a tick mark on the rim that nobody could read.
 *
 * So Money gets the month as a track: what you've spent filling from the left,
 * a marker showing where today falls, and the gap between them telling you
 * whether you're ahead or behind at a glance. Same tokens, same borders, same
 * colours — coral once you're over — so it still belongs to the same app. The
 * shared grammar is the palette and the chunk, not the geometry.
 *
 * Four modes, driven by what the user has actually set up:
 *   total  — an overall monthly cap is set, so the bar is spent ÷ that
 *   budget — no total, but category budgets exist: bar is spent ÷ their sum
 *   income — neither, but income logged: bar is spent ÷ income
 *   none   — nothing to divide by; show the raw spend and no bar
 */
export default function BudgetSummary({
  transactions,
  budgets,
  budgetTotal = 0,
  categoryTotals,
  month,
  loading = false,
}) {
  const summary = budgetSummary(transactions, budgets, budgetTotal)

  if (loading) return <BudgetSummarySkeleton />

  const hasLimit = summary.mode !== 'none'
  const over = summary.over
  const pace = monthProgress(month)
  const live = isCurrentMonth(month)
  // Ahead of schedule = you've burned less of the budget than of the month.
  const onPace = hasLimit && !over && summary.progress <= pace + 0.03

  const headline = hasLimit ? Math.abs(round0(summary.remaining)) : round0(summary.spent)
  const caption = !hasLimit ? 'spent so far' : over ? 'over budget' : 'left to spend'

  const days = daysInMonth(month)
  const dayOfMonth = live ? Math.max(1, Math.round(pace * days)) : days

  // Only the three biggest categories get a bar — a nine-bar wall of colour is
  // a chart, and the chart is right below this card.
  const topCategories = categoryTotals.slice(0, 3)

  return (
    <section
      className="card-stacked"
      aria-label={`Money for the month: ${formatMoney(summary.spent)} spent`}
    >
      <div className="card overflow-hidden p-5 pb-4">
        {/* ── The number ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps">{caption}</p>
            <p
              className={`nums font-display ${over ? 'text-coral-500' : 'text-ink-900'} ${
                headline >= 100000 ? 'text-money-long' : 'text-money'
              }`}
            >
              {formatMoney(headline)}
            </p>
            <p className="mt-1.5 text-xs font-bold text-ink-400">
              {/* 'earned' only for the income fallback — both budget modes are
                  money the user set aside, not money that came in. */}
              {hasLimit
                ? `of ${formatMoney(summary.limit)} ${summary.mode === 'income' ? 'earned' : 'budgeted'}`
                : 'no budget set yet'}
            </p>
          </div>

          {onPace && live && (
            <motion.div
              className="shrink-0"
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 15, delay: 0.2 }}
            >
              <Icon3D name="sparkles" size={44} />
            </motion.div>
          )}
          {over && <Icon3D name="chartdown" size={44} className="shrink-0" />}
        </div>

        {/* ── The month, as a track ───────────────────────────────────── */}
        {hasLimit ? (
          <div className="mt-4">
            <MonthTrack progress={summary.progress} over={over} pace={pace} live={live} />

            <div className="mt-2 flex items-baseline justify-between gap-2 text-[0.7rem] font-bold">
              <span className={over ? 'text-coral-600' : 'text-ink-500'}>
                <span className="nums font-display text-sm font-extrabold">
                  {Math.round(summary.progress * 100)}%
                </span>{' '}
                of budget
              </span>

              <span className="truncate text-ink-400">
                {live ? (
                  <>
                    day <span className="nums">{dayOfMonth}</span> of{' '}
                    <span className="nums">{days}</span> ·{' '}
                    <span className={onPace ? 'text-lime-700' : over ? 'text-coral-600' : 'text-ink-500'}>
                      {over ? 'over' : onPace ? 'ahead' : 'behind pace'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="nums">{days}</span> days · closed
                  </>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink-900/15 p-3">
            <Icon3D name="target" size={30} />
            <p className="text-xs font-semibold leading-snug text-ink-400">
              Set a total for the month in Budgets and this becomes a countdown.
            </p>
          </div>
        )}

        {/* Spent / in / net */}
        <div className="mt-5 flex items-center justify-center gap-1 rounded-2xl border-2 border-ink-900/10 bg-cream-100 p-2">
          <Chip label="spent" value={formatMoney(summary.spent, { compact: true })} tone="ink" />
          <span className="h-7 w-px bg-ink-900/10" />
          <Chip label="income" value={formatMoney(summary.income, { compact: true })} tone="lime" />
          <span className="h-7 w-px bg-ink-900/10" />
          <Chip
            label="net"
            value={formatMoney(summary.net, { compact: true, sign: true })}
            tone={summary.net < 0 ? 'coral' : 'lime'}
          />
        </div>

        {/* Top categories */}
        {topCategories.length > 0 ? (
          <div className="mt-5 space-y-3.5">
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
          <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink-900/15 p-3.5">
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
              value={formatMoney(summary.spent / Math.max(1, Math.round(pace * days)), {
                compact: true,
              })}
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

/**
 * The month as a single bar: spend filling from the left, today marked on it.
 *
 * The marker is the whole point. Filled past it means you're spending faster
 * than the month is passing — the one thing a budget can tell you that a
 * running total can't, and something the arc's tick on the rim never managed
 * to say out loud.
 */
function MonthTrack({ progress, over, pace, live }) {
  const filled = Math.min(1, progress)
  const overflow = Math.min(1, Math.max(0, progress - 1))

  return (
    <div
      className="relative h-6 w-full overflow-hidden rounded-pill border-2 border-ink-900/15 bg-cream-200 shadow-inset"
      role="progressbar"
      aria-label="Budget used this month"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-pill"
        style={{ background: over ? '#FF5A38' : '#C6F32B' }}
        initial={false}
        animate={{ width: `${filled * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />

      {/* Past the cap: hard stripes, so "just over" and "double" don't look
          identical the way a clamped bar makes them. */}
      {over && (
        <motion.div
          className="absolute inset-y-0 right-0"
          style={{
            background: 'repeating-linear-gradient(45deg, #B32E13 0 6px, #E33E1C 6px 12px)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(overflow, 0.08) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      )}

      {/* Where today falls. Only on a month still running — on a closed month
          "today" is off the end and the line would just sit against the edge. */}
      {live && (
        <span
          className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-pill bg-ink-900/70"
          style={{ left: `${pace * 100}%` }}
          aria-hidden="true"
          title="Where today falls in the month"
        />
      )}
    </div>
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
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-2.5 h-12 w-3/5" />
        <div className="skeleton mt-3 h-3 w-32" />
        <div className="skeleton mt-4 h-6 w-full rounded-pill" />
        <div className="skeleton mt-5 h-14 w-full" />
        <div className="mt-5 space-y-4">
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
