/**
 * Clock and chart arithmetic for the Hospital module.
 *
 * The one rule this file exists to enforce: a chart row's time is a *wall
 * clock* time on a *calendar day*, and the two are stored separately —
 * `date` is the bare day the row belongs to, `at` is the timestamp it happened
 * at. Everything below converts between the two through local date parts, never
 * through toISOString() on a date-only string, which would drop an 00:30 IST
 * drink onto yesterday's chart.
 */

import { fromISODate } from './dateHelpers'
import { UNIT_META } from '../data/hospitalItems'

const pad = (n) => String(n).padStart(2, '0')

/** Right now as 'HH:MM', 24h — what an <input type="time"> wants. */
export function nowHM(now = new Date()) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** A stored timestamp back to 'HH:MM', for pre-filling the edit form. */
export function hmFromISO(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return nowHM()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * A calendar day plus a wall-clock time → a real instant.
 *
 * Built from local parts, so 'HH:MM' means what the clock on the wall said,
 * whatever timezone the phone is in.
 */
export function isoAt(dateISO, hm) {
  const base = fromISODate(dateISO)
  const [h, m] = String(hm ?? '')
    .split(':')
    .map(Number)
  base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return base.toISOString()
}

/** '8:42 pm' — the reading on the chart. */
export function formatClock(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * The same reading, split for the chart's narrow time gutter: '8:42' and 'pm'.
 *
 * A phone can't spare 60px of gutter for "8:42 pm" on one line, and stacking
 * the meridiem under the time buys back a third of the row's width. Locales on
 * a 24-hour clock produce no suffix at all — there's nothing to stack, and the
 * gutter just holds '20:42'.
 */
export function clockParts(iso) {
  const label = formatClock(iso)
  const cut = label.lastIndexOf(' ')
  if (cut === -1) return { time: label, suffix: '' }
  return { time: label.slice(0, cut), suffix: label.slice(cut + 1) }
}

/** Hour of the day (0–23) a row happened in. */
export function hourOf(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 0 : d.getHours()
}

/**
 * The chart's horizontal rules, in clock order across one day.
 *
 * Not the food log's meal sections: this chart runs midnight to midnight
 * because a 3am drink is a real observation on a ward, and burying it under
 * "Night" at the bottom of the page would put the start of the day at the end.
 */
export const BANDS = [
  { id: 'overnight', label: 'Overnight', icon: 'moon', from: 0, to: 6 },
  { id: 'morning', label: 'Morning', icon: 'sunrise', from: 6, to: 12 },
  { id: 'afternoon', label: 'Afternoon', icon: 'sun', from: 12, to: 17 },
  { id: 'evening', label: 'Evening', icon: 'star', from: 17, to: 21 },
  { id: 'night', label: 'Night', icon: 'moon', from: 21, to: 24 },
]

export function bandOf(iso) {
  const hour = hourOf(iso)
  return BANDS.find((band) => hour >= band.from && hour < band.to) ?? BANDS[0]
}

/** Group a day's rows into bands, in clock order, dropping the empty ones. */
export function groupByBand(rows = []) {
  const buckets = new Map(BANDS.map((band) => [band.id, []]))
  for (const row of rows) buckets.get(bandOf(row.at).id).push(row)
  return BANDS.map((band) => ({ band, rows: buckets.get(band.id) })).filter(
    (section) => section.rows.length > 0
  )
}

/** Oldest first — a chart is read top to bottom, in the order it happened. */
export function sortByTime(rows = []) {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const at = new Date(a.at).getTime() - new Date(b.at).getTime()
    return at !== 0 ? at : (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })
}

/** Total millilitres across the drink rows. Meds are never fluid volume here. */
export function sumMl(rows = []) {
  return rows.reduce(
    (total, row) => (row.kind === 'drink' ? total + (Number(row.amount) || 0) : total),
    0
  )
}

/**
 * Cumulative ml at each drink row, keyed by id.
 *
 * The number a fluid chart is actually kept for is the running total, not any
 * single cup — so each row carries "and that made it 1,050 ml".
 */
export function runningTotals(rows = []) {
  const totals = {}
  let sum = 0
  for (const row of sortByTime(rows)) {
    if (row.kind !== 'drink') continue
    sum += Number(row.amount) || 0
    totals[row.id] = sum
  }
  return totals
}

/** '1,450' — separators, because four digits of millilitres is the normal case. */
export function formatMl(value) {
  return Math.round(Number(value) || 0).toLocaleString()
}

/** 1 → '1 tablet', 2 → '2 tablets', 5 → '5 ml'. Never '1.0'. */
export function formatDose(amount, unit) {
  const n = Number(amount) || 0
  const meta = UNIT_META[unit] ?? UNIT_META.unit
  const clean = Number(n.toFixed(1)).toString()
  return `${clean} ${n === 1 ? meta.label : meta.plural}`
}

/** How long ago, in the coarse words a chart note uses. */
export function sinceLabel(iso, now = new Date()) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const minutes = Math.round((now - then) / 60000)
  if (minutes < 0) return 'just now'
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Fraction of the fluid target reached, clamped for anything driving a bar. */
export function fillRatio(ml, target) {
  if (!target || target <= 0) return 0
  return Math.min(1, Math.max(0, (Number(ml) || 0) / target))
}
