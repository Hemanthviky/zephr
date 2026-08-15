/**
 * What each module's report actually says.
 *
 * One builder per module, each turning raw rows into the same shape — columns,
 * records, summary cards, day groups — so `utils/reports.js` can render either
 * a CSV or a printed page from it without knowing what a meal or a wallet is.
 *
 * Columns carry two optional formatters: `csv` for the file (plain, parseable,
 * no ₹ or thousands separators where a spreadsheet would have to undo them)
 * and `print` for the page (formatted for a human). Where both are absent the
 * raw value is used, which is right for names and notes.
 */

import { fromISODate } from './dateHelpers'
import { formatMoney } from './expenseMath'
import { mealById, resolveMeal } from './meals'
import { round0, round1 } from './nutritionMath'
import { formatClock, formatDose, formatMl, sumMl } from './hospitalMath'
import { describeLog } from '../data/hospitalItems'
import { daysInRange } from './reports'

/**
 * The coloured tab down the left of every printed row.
 *
 * The same job it does on screen: let someone find "the evening ones" or "the
 * medicines" by scanning a column rather than reading it. On paper it's the one
 * piece of colour that survives being photocopied badly.
 */
const MEAL_TABS = {
  morning: '#FFA51F',
  afternoon: '#C6F32B',
  evening: '#FF5A38',
  night: '#6C63E0',
  snack: '#12B39A',
}

/**
 * "Sat, 9 Aug 2026" — the group heading on the report.
 *
 * Assembled from parts rather than handed to `toLocaleDateString` whole: asking
 * for all four fields at once gets you "Sat, 9 Aug, 2026" on some ICU builds and
 * "Sat 9 Aug 2026" on others, and a report shouldn't be punctuated differently
 * depending on which browser exported it. Only the two names are localised.
 */
function dayHeading(iso) {
  const date = fromISODate(iso)
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' })
  const month = date.toLocaleDateString('en-IN', { month: 'short' })
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

/** Split rows into day sections, in whichever direction the module reads. */
function groupByDay(rows, { ascending = true, meta = () => '' } = {}) {
  const days = new Map()
  for (const row of rows) {
    if (!days.has(row.date)) days.set(row.date, [])
    days.get(row.date).push(row)
  }
  return [...days.keys()]
    .sort((a, b) => (ascending ? a.localeCompare(b) : b.localeCompare(a)))
    .map((date) => ({ label: dayHeading(date), meta: meta(days.get(date)), rows: days.get(date) }))
}

/* ── Calories ────────────────────────────────────────────────────────────── */

function caloriesReport(rows, _extras, range) {
  const total = rows.reduce(
    (sum, row) => ({
      calories: sum.calories + (Number(row.calories) || 0),
      protein: sum.protein + (Number(row.protein) || 0),
      carbs: sum.carbs + (Number(row.carbs) || 0),
      fat: sum.fat + (Number(row.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  // Averaged over the days of the *range*, not the days that happen to have
  // entries: a week where you logged four days averaged over four would read
  // as a full week's habit, which is the opposite of what the number is for.
  const days = daysInRange(range.from, range.to)

  return {
    title: 'Calorie report',
    subtitle: 'Calorie log',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'meal', label: 'Section', csv: (r) => mealById(resolveMeal(r)).label, print: (r) => mealById(resolveMeal(r)).label },
      { key: 'name', label: 'Food' },
      { key: 'grams', label: 'Grams', align: 'right', csv: (r) => round1(r.grams), print: (r) => `${round1(r.grams)} g` },
      { key: 'calories', label: 'kcal', align: 'right', csv: (r) => round0(r.calories), print: (r) => round0(r.calories).toLocaleString() },
      { key: 'protein', label: 'Protein', align: 'right', csv: (r) => round1(r.protein), print: (r) => `${round1(r.protein)} g` },
      { key: 'carbs', label: 'Carbs', align: 'right', csv: (r) => round1(r.carbs), print: (r) => `${round1(r.carbs)} g` },
      { key: 'fat', label: 'Fat', align: 'right', csv: (r) => round1(r.fat), print: (r) => `${round1(r.fat)} g` },
    ],
    summary: [
      { label: 'Entries', value: String(rows.length) },
      { label: 'Total energy', value: `${round0(total.calories).toLocaleString()} kcal` },
      { label: 'Daily average', value: `${round0(total.calories / days).toLocaleString()} kcal`, hint: `over ${days} ${days === 1 ? 'day' : 'days'}` },
      { label: 'Protein', value: `${round0(total.protein)} g` },
      { label: 'Carbs', value: `${round0(total.carbs)} g` },
      { label: 'Fat', value: `${round0(total.fat)} g` },
    ],
    accent: (row) => MEAL_TABS[resolveMeal(row)] ?? MEAL_TABS.snack,
    groups: groupByDay(rows, {
      ascending: true,
      meta: (dayRows) =>
        `${round0(dayRows.reduce((sum, r) => sum + (Number(r.calories) || 0), 0)).toLocaleString()} kcal`,
    }),
  }
}

/* ── Money ───────────────────────────────────────────────────────────────── */

function moneyReport(rows, extras) {
  const categories = new Map((extras.categories ?? []).map((c) => [c.id, c.name]))
  const wallets = new Map((extras.wallets ?? []).map((w) => [w.id, w.name]))

  const expense = rows.filter((r) => r.type !== 'income').reduce((s, r) => s + Number(r.amount || 0), 0)
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0)

  const nameOf = (row) => categories.get(row.category_id) ?? 'Uncategorised'
  const walletOf = (row) => wallets.get(row.wallet_id) ?? '—'

  return {
    title: 'Money report',
    subtitle: 'Expenses & income',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type', csv: (r) => (r.type === 'income' ? 'Income' : 'Expense'), print: (r) => (r.type === 'income' ? 'Income' : 'Expense') },
      { key: 'category_id', label: 'Category', csv: nameOf, print: nameOf },
      { key: 'wallet_id', label: 'Wallet', csv: walletOf, print: walletOf },
      { key: 'note', label: 'Note', csv: (r) => r.note ?? '', print: (r) => r.note ?? '' },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        // Bare number in the file so a spreadsheet can sum it; the sign carries
        // the direction, which is what a ledger column is for.
        csv: (r) => (r.type === 'income' ? 1 : -1) * Number(r.amount || 0),
        print: (r) => formatMoney(Number(r.amount || 0), { sign: false }),
      },
    ],
    summary: [
      { label: 'Transactions', value: String(rows.length) },
      { label: 'Spent', value: formatMoney(expense) },
      { label: 'Received', value: formatMoney(income) },
      { label: 'Net', value: formatMoney(income - expense, { sign: true }), hint: income - expense >= 0 ? 'in hand' : 'over' },
    ],
    accent: (row) => (row.type === 'income' ? '#12B39A' : '#FF5A38'),
    // Newest first, the way the ledger reads on screen.
    groups: groupByDay(rows, {
      ascending: false,
      meta: (dayRows) =>
        formatMoney(
          dayRows.filter((r) => r.type !== 'income').reduce((s, r) => s + Number(r.amount || 0), 0)
        ) + ' spent',
    }),
  }
}

/* ── Intake ──────────────────────────────────────────────────────────────── */

function intakeReport(rows, _extras, range) {
  const drinks = rows.filter((r) => r.kind === 'drink')
  const meds = rows.filter((r) => r.kind === 'med')
  const ml = sumMl(drinks)
  const days = daysInRange(range.from, range.to)

  return {
    title: 'Intake chart',
    subtitle: 'Fluids & medicines',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'at', label: 'Time', csv: (r) => formatClock(r.at), print: (r) => formatClock(r.at) },
      { key: 'kind', label: 'Type', csv: (r) => (r.kind === 'med' ? 'Medicine' : 'Drink'), print: (r) => (r.kind === 'med' ? 'Medicine' : 'Drink') },
      { key: 'name', label: 'Item' },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        csv: (r) => `${round1(r.amount)} ${r.unit}`,
        print: (r) => (r.kind === 'med' ? formatDose(r.amount, r.unit) : `${formatMl(r.amount)} ml`),
      },
      { key: 'note', label: 'Note', csv: (r) => r.note ?? '', print: (r) => r.note ?? '' },
    ],
    summary: [
      { label: 'Fluid total', value: `${formatMl(ml)} ml` },
      { label: 'Daily average', value: `${formatMl(ml / days)} ml`, hint: `over ${days} ${days === 1 ? 'day' : 'days'}` },
      { label: 'Drinks', value: String(drinks.length) },
      { label: 'Doses', value: String(meds.length) },
    ],
    // The chart's own colours: each drink and each medicine form has one.
    accent: (row) => describeLog(row).tint,
    groups: groupByDay(rows, {
      ascending: true,
      meta: (dayRows) => {
        const dayMl = sumMl(dayRows)
        const doses = dayRows.filter((r) => r.kind === 'med').length
        return `${formatMl(dayMl)} ml · ${doses} ${doses === 1 ? 'dose' : 'doses'}`
      },
    }),
  }
}

/* ── The registry ────────────────────────────────────────────────────────── */

/**
 * Everything a report needs to be fetched and rendered, per module.
 *
 * `table`, `dateColumn` and `order` are what the hook queries with; the builder
 * is what turns the answer into a document.
 */
export const REPORT_KINDS = {
  calories: {
    id: 'calories',
    label: 'Calories',
    icon: 'salad',
    blurb: 'Everything you ate, with its macros',
    table: 'entries',
    order: [{ column: 'date' }, { column: 'created_at' }],
    build: caloriesReport,
  },
  money: {
    id: 'money',
    label: 'Money',
    icon: 'receipt',
    blurb: 'Every expense and every rupee in',
    table: 'transactions',
    order: [{ column: 'date' }, { column: 'created_at' }],
    needs: ['categories', 'wallets'],
    build: moneyReport,
  },
  intake: {
    id: 'intake',
    label: 'Intake',
    icon: 'clipboard',
    blurb: 'Fluids and medicines, hour by hour',
    table: 'hospital_logs',
    order: [{ column: 'date' }, { column: 'at' }],
    build: intakeReport,
  },
}

export function buildReport(kind, rows, extras, range) {
  return REPORT_KINDS[kind].build(rows, extras, range)
}
