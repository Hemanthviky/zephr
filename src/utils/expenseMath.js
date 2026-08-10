/**
 * Money arithmetic and month handling. Pure functions only, same as
 * utils/nutritionMath.js — and it borrows that file's ratio helpers rather than
 * redefining them, so a budget arc and a calorie arc behave identically.
 */

import { fromISODate, toISODate, todayISO } from './dateHelpers'
import { clampedRatio, goalStatus, ratio, round0 } from './nutritionMath'

export { clampedRatio, goalStatus, ratio }

/**
 * Currency. Rupees, because that's what the food side is pitched at — change
 * these three values and every amount in the app follows.
 */
export const CURRENCY = { code: 'INR', symbol: '₹', locale: 'en-IN' }

const compactFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/**
 * ₹1,240 — no decimals, because nobody budgets in paise and ".00" on every row
 * is visual noise. Amounts under ₹100 keep their decimals if they have any.
 */
export function formatMoney(amount, { compact = false, sign = false } = {}) {
  const value = Number(amount) || 0
  const abs = Math.abs(value)

  let body
  if (compact && abs >= 10000) {
    body = compactFormatter.format(abs)
  } else {
    const decimals = abs > 0 && abs < 100 && !Number.isInteger(abs) ? 2 : 0
    body = abs.toLocaleString(CURRENCY.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  const prefix = sign && value !== 0 ? (value > 0 ? '+' : '−') : value < 0 ? '−' : ''
  return `${prefix}${CURRENCY.symbol}${body}`
}

/* ────────────────────────────────────────────────────────────────────────────
   Months
   A "month" is stored and passed around as the ISO date of its first day
   ('2026-08-01'), matching the `budgets.month` column and its day = 1 check.
   ──────────────────────────────────────────────────────────────────────────── */

export function monthOf(isoDate) {
  return `${isoDate.slice(0, 7)}-01`
}

export function currentMonth() {
  return monthOf(todayISO())
}

export function addMonths(month, n) {
  const d = fromISODate(month)
  d.setMonth(d.getMonth() + n, 1) // pin to the 1st before shifting: 31 Jan + 1 ≠ 3 Mar
  return toISODate(d)
}

/** Inclusive [start, end] ISO bounds for a month — what the query filters on. */
export function monthBounds(month) {
  const start = fromISODate(month)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return { start: toISODate(start), end: toISODate(end) }
}

export function isCurrentMonth(month) {
  return month === currentMonth()
}

export function isFutureMonth(month) {
  return month > currentMonth()
}

/** "August 2026", or "This month" for the one we're in. */
export function formatMonthLabel(month, { short = false } = {}) {
  if (!short && isCurrentMonth(month)) return 'This month'
  return fromISODate(month).toLocaleDateString(undefined, {
    month: short ? 'short' : 'long',
    year: 'numeric',
  })
}

/** "Aug" — for chart axes, where the year is implied by the sequence. */
export function shortMonth(month) {
  return fromISODate(month).toLocaleDateString(undefined, { month: 'short' })
}

/** The n months ending at `month`, oldest first. Drives the trend chart. */
export function lastNMonths(month, n = 6) {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - (n - 1)))
}

/** How far through the month we are, 0–1 — used to pace-check spending. */
export function monthProgress(month) {
  if (!isCurrentMonth(month)) return 1
  const { end } = monthBounds(month)
  const today = fromISODate(todayISO()).getDate()
  return today / fromISODate(end).getDate()
}

/* ────────────────────────────────────────────────────────────────────────────
   Totals
   ──────────────────────────────────────────────────────────────────────────── */

/** { expense, income, net } for a set of transactions. */
export function sumTransactions(transactions = []) {
  let expense = 0
  let income = 0
  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    if (tx.type === 'income') income += amount
    else expense += amount
  }
  return { expense, income, net: income - expense }
}

/**
 * Spending per category, biggest first. Income is excluded — a salary credit in
 * a "Shopping" donut would be nonsense.
 *
 * Returns rows shaped for both the list and recharts:
 *   { id, name, icon, color, total, share, budget, transactions }
 */
export function totalsByCategory(transactions = [], categories = [], budgets = {}) {
  const index = new Map(categories.map((c) => [c.id, c]))
  const buckets = new Map()

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const key = tx.category_id ?? 'none'
    const bucket = buckets.get(key) ?? { total: 0, count: 0 }
    bucket.total += Number(tx.amount) || 0
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const spent = [...buckets.values()].reduce((sum, b) => sum + b.total, 0)

  return [...buckets.entries()]
    .map(([id, bucket]) => {
      const category = index.get(id)
      return {
        id,
        name: category?.name ?? 'Uncategorised',
        icon: category?.icon ?? 'receipt',
        color: category?.color ?? '#BDB4A2',
        total: bucket.total,
        count: bucket.count,
        share: spent > 0 ? bucket.total / spent : 0,
        budget: Number(budgets[id]) || 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

/** Sum of every per-category budget set for the month. 0 means "none set". */
export function totalBudget(budgets = {}) {
  return Object.values(budgets).reduce((sum, amount) => sum + (Number(amount) || 0), 0)
}

/**
 * The single number the hero ring is built around.
 *
 * Two modes, because "what's left" means different things depending on how the
 * user has set the month up:
 *   • budgets set → cap is the sum of category budgets, spent counts expenses.
 *   • no budgets  → cap is income logged this month, so the ring reads as
 *                   "how much of what came in is still here".
 * With neither, there's nothing to divide by and the ring stays empty.
 */
export function budgetSummary(transactions, budgets) {
  const { expense, income, net } = sumTransactions(transactions)
  const cap = totalBudget(budgets)
  const usingBudget = cap > 0

  const limit = usingBudget ? cap : income
  const remaining = limit - expense

  return {
    mode: usingBudget ? 'budget' : income > 0 ? 'income' : 'none',
    limit,
    spent: expense,
    income,
    net,
    remaining,
    progress: clampedRatio(expense, limit),
    status: goalStatus(expense, limit),
    over: limit > 0 && expense > limit,
  }
}

/**
 * Spend per month across a window, for the trend line. Transactions may span
 * several months, so bucket by the month each one falls in.
 */
export function monthlyTotals(transactions = [], months = []) {
  const buckets = new Map(months.map((m) => [m, { expense: 0, income: 0 }]))

  for (const tx of transactions) {
    const bucket = buckets.get(monthOf(tx.date))
    if (!bucket) continue
    const amount = Number(tx.amount) || 0
    if (tx.type === 'income') bucket.income += amount
    else bucket.expense += amount
  }

  return months.map((month) => ({
    month,
    label: shortMonth(month),
    expense: round0(buckets.get(month).expense),
    income: round0(buckets.get(month).income),
  }))
}

/** Average of the non-empty months — a flat zero drags the average into a lie. */
export function averageSpend(series = []) {
  const active = series.filter((point) => point.expense > 0)
  if (!active.length) return 0
  return active.reduce((sum, point) => sum + point.expense, 0) / active.length
}
