/**
 * Report plumbing: date ranges, CSV, and a printable document.
 *
 * Two formats, on purpose. CSV is what you want when the report is going
 * somewhere else — a spreadsheet, an accountant, a doctor's own records — and
 * it opens everywhere without asking. The printable version is what you want
 * when a person is going to *read* it, and "Save as PDF" in the print dialog
 * is a PDF exporter every browser already ships, which beats adding a megabyte
 * of PDF library to a tracker.
 *
 * Nothing here touches the network or React. Everything takes rows and gives
 * back a string, so what lands in the file is decided in one readable place.
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
 * Hand the file to the browser.
 *
 * The BOM is for Excel, which otherwise reads a UTF-8 CSV as the local ANSI
 * codepage and turns every ₹ and every "–" into mojibake.
 */
export function downloadCSV(filename, csv) {
  triggerDownload(filename, new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }))
}

export function downloadHTML(filename, html) {
  triggerDownload(filename, new Blob([html], { type: 'text/html;charset=utf-8;' }))
}

function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick, not immediately: Safari hasn't started reading
  // the blob by the time click() returns, and a revoked URL downloads nothing.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `zephr-food-2026-08-01_2026-08-10.csv` — sorts and self-describes. */
export function reportFilename(kind, from, to, extension) {
  const span = from === to ? from : `${from}_${to}`
  return `zephr-${kind}-${span}.${extension}`
}

/* ── The printable document ──────────────────────────────────────────────── */

const escapeHTML = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Same rule as the app's Avatar: first and last initial, or the first two. */
function initialsOf(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * And the same tile colour, by the same hash — so the monogram on the page is
 * the monogram in the app. Duplicated rather than imported from the component:
 * this file builds a string for another document and must not depend on React.
 */
const TILES = [
  { bg: '#C6F32B', edge: '#657F04' },
  { bg: '#FF9E85', edge: '#B32E13' },
  { bg: '#FFCB6B', edge: '#E08600' },
  { bg: '#6FD9C2', edge: '#0C8F7B' },
  { bg: '#E6FF94', edge: '#8CB300' },
]

function tileFor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % 997
  return TILES[hash % TILES.length]
}

/**
 * A standalone HTML report, built to look like the app rather than like a
 * database dump.
 *
 * The header is the membership card from the profile panel — striped lime band,
 * monogram punched through it, the reader's name in hero type — and the body is
 * the app's own furniture: tactile cards with a hard bottom edge, day sections
 * headed like the log's meal bands, rows with a coloured left tab. Someone
 * handing this to a doctor or an accountant should recognise where it came
 * from, and someone reading it should find it laid out the way the screen was.
 *
 * Print realities the screen doesn't have: A4 margins, `thead` repeating on
 * every sheet, `break-inside: avoid` on rows and day sections, and
 * `print-color-adjust: exact` — without that last one browsers strip every
 * background and the whole thing prints as grey text on white.
 *
 * Self-contained by construction: inline CSS, no images, no scripts. The web
 * fonts are a progressive enhancement — if the file is opened offline it falls
 * back to the system stack and the layout is unchanged.
 */
export function buildReportHTML({
  title,
  subtitle,
  rangeLabel,
  userName = '',
  userEmail = '',
  generatedAt = new Date(),
  summary = [],
  columns,
  rows,
  groups = null,
  accent = null,
  note = '',
  interactive = false,
}) {
  const head = columns
    .map(
      (column) =>
        `<th class="${column.align === 'right' ? 'r' : ''}">${escapeHTML(column.label)}</th>`
    )
    .join('')

  const renderRow = (row) => {
    const tint = accent?.(row)
    const cells = columns
      .map((column) => {
        const value = column.print ? column.print(row) : row[column.key]
        return `<td class="${column.align === 'right' ? 'r num' : ''}">${escapeHTML(value)}</td>`
      })
      .join('')
    return `<tr${tint ? ` style="--tab:${escapeHTML(tint)}"` : ''}>${cells}</tr>`
  }

  const table = (bodyRows) =>
    `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`

  const body = groups
    ? groups
        .map(
          (group) => `<section class="day">
            <div class="day-head">
              <span class="day-name">${escapeHTML(group.label)}</span>
              ${group.meta ? `<span class="day-meta">${escapeHTML(group.meta)}</span>` : ''}
            </div>
            ${table(group.rows.map(renderRow).join(''))}
          </section>`
        )
        .join('')
    : `<section class="day">${table(rows.map(renderRow).join(''))}</section>`

  const cards = summary
    .map(
      (item) =>
        `<div class="card"><span class="k">${escapeHTML(item.label)}</span><strong class="v">${escapeHTML(
          item.value
        )}</strong>${item.hint ? `<span class="h">${escapeHTML(item.hint)}</span>` : ''}</div>`
    )
    .join('')

  const stamp = generatedAt.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}${userName ? ` — ${escapeHTML(userName)}` : ''} — ${escapeHTML(rangeLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  :root {
    --cream-50:#FFFDF7; --cream-100:#FDF7EA; --cream-200:#F7EDD8; --cream-300:#EFE0C2;
    --ink:#1B1915; --ink-500:#6E6659; --ink-400:#948B7B; --ink-300:#BDB4A2;
    --lime:#C6F32B; --tab:#BDB4A2;
    --tile:${tileFor(userName).bg}; --tile-edge:${tileFor(userName).edge};
  }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin:0; padding:22px 18px;
    font:13px/1.55 "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
    color:var(--ink); background:var(--cream-100);
  }
  .sheet { max-width:940px; margin:0 auto; }
  .display { font-family:"Bricolage Grotesque", ui-rounded, Georgia, serif; font-weight:800;
             letter-spacing:-.02em; }

  /* ── The card, lifted from the profile panel ─────────────────────────── */
  .id { position:relative; border:2.5px solid var(--ink); border-radius:26px;
        background:var(--cream-50); overflow:hidden; margin-bottom:16px;
        box-shadow:0 4px 0 0 var(--ink); }
  .band { position:relative; height:64px; background:var(--lime);
          background-image:repeating-linear-gradient(45deg, rgba(27,25,21,.18) 0 2px, transparent 2px 11px); }
  .band .mark { position:absolute; right:14px; top:13px; font-size:9.5px; font-weight:800;
                letter-spacing:.28em; text-transform:uppercase; color:rgba(27,25,21,.62); }
  .id-body { position:relative; padding:0 18px 16px; }
  .who { display:flex; align-items:flex-end; gap:12px; margin-top:-30px; }
  .mono { width:64px; height:64px; border-radius:21px; border:2px solid var(--ink);
          background:var(--tile); box-shadow:0 4px 0 0 var(--tile-edge), 0 0 0 4px var(--cream-50);
          display:flex; align-items:center; justify-content:center;
          font-size:23px; }
  .who-text { padding-bottom:2px; }
  .who-text .k { margin-bottom:1px; }
  .name { font-size:26px; line-height:1.05; }
  .email { font-size:11px; font-weight:700; color:var(--ink-400); }
  .rule { margin:14px 0 12px; border-top:2px dashed rgba(27,25,21,.2); }
  .titles { display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
            flex-wrap:wrap; }
  h1 { margin:0; font-size:21px; }
  .sub { font-size:11.5px; font-weight:700; color:var(--ink-400); }
  .range { display:inline-block; padding:5px 12px; border:2px solid var(--ink); border-radius:999px;
           background:var(--lime); font-size:11.5px; font-weight:800; box-shadow:0 3px 0 0 var(--ink); }

  /* ── Summary cards ───────────────────────────────────────────────────── */
  .cards { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 16px; }
  .card { flex:1 1 128px; border:2px solid rgba(27,25,21,.12); border-radius:16px;
          background:var(--cream-50); padding:9px 11px; box-shadow:0 3px 0 0 rgba(27,25,21,.07); }
  .k { display:block; font-size:9px; font-weight:800; letter-spacing:.14em;
       text-transform:uppercase; color:var(--ink-400); }
  .v { display:block; margin-top:2px; font-family:"Bricolage Grotesque", ui-rounded, Georgia, serif;
       font-size:19px; font-weight:800; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
  .h { display:block; font-size:10px; font-weight:700; color:var(--ink-300); }

  /* ── Day sections, headed like the log's bands ───────────────────────── */
  .day { margin-bottom:14px; break-inside:avoid; }
  .day-head { display:flex; align-items:baseline; gap:10px; padding:0 2px 5px; }
  .day-name { font-family:"Bricolage Grotesque", ui-rounded, Georgia, serif; font-size:11px;
              font-weight:800; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap; }
  .day-head::after { content:""; flex:1; height:2px; background:rgba(27,25,21,.12); border-radius:2px;
                     order:1; }
  .day-meta { order:2; font-size:11px; font-weight:800; color:var(--ink-400);
              font-variant-numeric:tabular-nums; white-space:nowrap; }

  table { width:100%; border-collapse:separate; border-spacing:0 4px; }
  thead { display:table-header-group; }
  th { text-align:left; font-size:8.5px; font-weight:800; letter-spacing:.14em;
       text-transform:uppercase; color:var(--ink-400); padding:2px 9px 4px; }
  tbody tr { break-inside:avoid; }
  td { background:var(--cream-50); padding:8px 9px; font-weight:600;
       border-top:2px solid rgba(27,25,21,.10); border-bottom:2px solid rgba(27,25,21,.10);
       vertical-align:top; }
  td:first-child { border-left:6px solid var(--tab); border-top-left-radius:14px;
                   border-bottom-left-radius:14px; font-weight:700; white-space:nowrap; }
  td:last-child { border-right:2px solid rgba(27,25,21,.10); border-top-right-radius:14px;
                  border-bottom-right-radius:14px; }
  .r { text-align:right; }
  .num { font-variant-numeric:tabular-nums; font-weight:800; }

  .empty { padding:30px; text-align:center; font-weight:700; color:var(--ink-400);
           border:2px dashed rgba(27,25,21,.2); border-radius:20px; background:var(--cream-50); }

  /* The bar exists only on screen — it's the way to reach the print dialog on a
     phone, where a page can't open one for a frame it isn't. It must never
     appear on the paper, hence the print rule at the bottom. */
  .bar { position:sticky; top:0; z-index:9; display:flex; align-items:center; gap:10px;
         flex-wrap:wrap; margin:0 0 14px; padding:10px 12px; border:2.5px solid var(--ink);
         border-radius:18px; background:var(--lime); box-shadow:0 4px 0 0 var(--ink); }
  .bar button { font:inherit; font-weight:800; font-size:13px; cursor:pointer;
                padding:9px 16px; min-height:42px; border:2px solid var(--ink); border-radius:999px;
                background:var(--cream-50); color:var(--ink); box-shadow:0 3px 0 0 var(--ink); }
  .bar button:active { transform:translateY(3px); box-shadow:none; }
  .bar span { font-size:11.5px; font-weight:700; color:rgba(27,25,21,.7); }
  @media print { .bar { display:none !important; } }
  footer { margin-top:14px; padding-top:11px; border-top:2px dashed rgba(27,25,21,.2);
           display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;
           font-size:10px; font-weight:700; color:var(--ink-400); }
</style></head>
<body><div class="sheet">
  ${
    interactive
      ? `<div class="bar">
           <button type="button" onclick="window.print()">Save as PDF</button>
           <span>Pick “Save as PDF” as the destination in the dialog.</span>
         </div>`
      : ''
  }
  <div class="id">
    <div class="band"><span class="mark">Zephr · ${escapeHTML(subtitle)}</span></div>
    <div class="id-body">
      <div class="who">
        <span class="mono display">${escapeHTML(initialsOf(userName))}</span>
        <span class="who-text">
          <span class="k">Report for</span>
          <span class="name display" style="display:block">${escapeHTML(userName || 'You')}</span>
          ${userEmail ? `<span class="email">${escapeHTML(userEmail)}</span>` : ''}
        </span>
      </div>

      <div class="rule"></div>

      <div class="titles">
        <span>
          <h1 class="display">${escapeHTML(title)}</h1>
          <span class="sub">${escapeHTML(subtitle)} · ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span>
        </span>
        <span class="range">${escapeHTML(rangeLabel)}</span>
      </div>
    </div>
  </div>

  ${cards ? `<div class="cards">${cards}</div>` : ''}
  ${rows.length ? body : '<p class="empty">Nothing was logged in this range.</p>'}

  <footer>
    <span>Generated ${escapeHTML(stamp)}${note ? ` · ${escapeHTML(note)}` : ''}</span>
    <span>Typed by hand, counted for you — Zephr</span>
  </footer>
</div>${
    interactive
      ? `
<script>
  // Offer the dialog straight away, once the webfonts have had a moment — the
  // whole point of the tap was to get a PDF. If it's dismissed, or a browser
  // declines to auto-open it, the button above is still sitting there.
  window.addEventListener('load', function () { setTimeout(function () { window.print() }, 450) })
</script>`
      : ''
  }
</body></html>`
}

/**
 * Open the report in a tab of its own, where it can print itself.
 *
 * This used to render into a hidden iframe and call `print()` on it. That works
 * on a desktop and is a trap on a phone: Android Chrome has no concept of
 * printing one frame, so `frame.contentWindow.print()` quietly prints the
 * *top-level* document instead — you tap "PDF" and get a picture of the app
 * with the report sheet open over it. There is no flag that fixes that; the
 * document has to be the one at the top of a window.
 *
 * So the report gets its own tab, and prints from inside itself. `window.open`
 * is called straight out of the click handler, which is what keeps it out of
 * the popup blocker. If a browser blocks it anyway, the caller is told and can
 * fall back to downloading the same page as a file.
 *
 * @returns {boolean} whether the tab opened
 */
export function openReport(html) {
  const view = window.open('', '_blank')
  if (!view) return false

  view.document.open()
  view.document.write(html)
  view.document.close()
  view.focus()
  return true
}
