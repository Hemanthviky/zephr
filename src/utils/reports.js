/**
 * Report plumbing: date ranges, CSV, and handing a file to the browser.
 *
 * Two formats, on purpose. CSV is what you want when the numbers are going
 * somewhere else — a spreadsheet, an accountant, a doctor's own records — and
 * it opens everywhere without asking. The PDF (see utils/reportPdf.js) is what
 * you want when a person is going to *read* it.
 *
 * Both are downloads, and deliberately nothing else. An earlier version opened
 * the report in a tab and asked the browser to print it, which cost two extra
 * taps on a desktop and misbehaved badly on a phone, where a new tab can push
 * an installed app into the background — so "download" looked like the app
 * closing itself.
 *
 * Nothing here touches the network or React. Everything takes rows and gives
 * back a string or a blob, so what lands in the file is decided in one place.
 */

import { addDays, formatFullDate, fromISODate, todayISO, toISODate } from './dateHelpers'

/* ── Date ranges ─────────────────────────────────────────────────────────── */

/**
 * The ranges people actually ask for, in the order they ask for them.
 *
 * "This month" and "Last 30 days" are both here and are not the same question:
 * one is a billing period, the other is a rolling window, and on the 3rd of the
 * month they differ by four weeks of data.
 */
export const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'all', label: 'Everything' },
]

/** The earliest day a report will reach back to for "Everything". */
const DAWN = '2000-01-01'

export function rangeFor(preset, today = todayISO()) {
  const now = fromISODate(today)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case 'last7':
      return { from: addDays(today, -6), to: today }
    case 'last30':
      return { from: addDays(today, -29), to: today }
    case 'thisMonth':
      return { from: toISODate(firstOfMonth), to: today }
    case 'lastMonth':
      return { from: toISODate(firstOfLastMonth), to: toISODate(lastOfLastMonth) }
    case 'thisYear':
      return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: today }
    case 'all':
      return { from: DAWN, to: today }
    default:
      return { from: today, to: today }
  }
}

/** How many days a range covers, inclusive of both ends. */
export function daysInRange(from, to) {
  return Math.max(1, Math.round((fromISODate(to) - fromISODate(from)) / 86_400_000) + 1)
}

/** "9 August 2026" for one day, "1 – 9 August 2026" for a span. */
export function formatRangeLabel(from, to) {
  if (from === to) return formatFullDate(from)
  if (from === DAWN) return `Everything up to ${formatFullDate(to)}`
  return `${formatFullDate(from)} — ${formatFullDate(to)}`
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/**
 * One cell, quoted whenever it could otherwise break the file.
 *
 * The leading-character guard is not cosmetic: a value starting with =, +, -
 * or @ is executed as a formula when the file is opened in Excel or Sheets, so
 * a note reading "=cmd|..." becomes a real problem on someone else's machine.
 * Prefixing an apostrophe keeps it text.
 */
function csvCell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCSV(columns, rows) {
  const head = columns.map((column) => csvCell(column.label)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => csvCell(column.csv ? column.csv(row) : row[column.key])).join(',')
  )
  return [head, ...body].join('\r\n')
}

/**
 * Byte-order mark, written as an escape rather than pasted in: a literal U+FEFF
 * is invisible in the source and one save in the wrong encoding drops it
 * without a trace.
 */
const BOM = '\uFEFF'

/**
 * Hand the file to the browser.
 *
 * The BOM is for Excel, which otherwise reads a UTF-8 CSV as the local ANSI
 * codepage and turns every ₹ and every "–" into mojibake.
 */
export function downloadCSV(filename, csv) {
  downloadBlob(filename, new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' }))
}

/**
 * Save a blob, with a route for every engine that doesn't do it the usual way.
 *
 *   • `<a download>` is the path everywhere current, including iOS 13+.
 *   • Some in-app webviews (the browser inside a chat app) hand you an anchor
 *     with no `download` support at all. There the blob is opened instead, and
 *     the user saves it from the viewer — worse, but not nothing.
 *   • Old Edge/IE exposed `msSaveOrOpenBlob` and nothing else. Two lines.
 *
 * The URL is revoked on a timer rather than immediately: several browsers,
 * Safari included, haven't started reading the blob by the time `click()`
 * returns, and a revoked URL saves an empty file. Ten seconds is long enough
 * for a slow phone and short enough not to leak.
 */
export function downloadBlob(filename, blob) {
  if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
    navigator.msSaveOrOpenBlob(blob, filename)
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  if ('download' in link) {
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    // Kept out of the layout and out of the tab order — it exists for one click.
    link.style.cssText = 'position:fixed;left:-9999px;opacity:0'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } else {
    window.open(url, '_blank', 'noopener')
  }

  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** `zephr-food-2026-08-01_2026-08-10.pdf` — sorts and self-describes. */
export function reportFilename(kind, from, to, extension) {
  const span = from === to ? from : `${from}_${to}`
  return `zephr-${kind}-${span}.${extension}`
}
