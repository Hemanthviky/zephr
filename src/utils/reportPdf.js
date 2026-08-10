/**
 * The report as a real PDF, drawn here rather than printed by the browser.
 *
 * The previous version opened the laid-out page in a tab and asked the browser
 * to print it. That is two taps too many, and on a phone it's worse than that:
 * a new tab can send an installed app to the background or replace it outright,
 * so "download" looked like the app closing itself. A file the browser saves
 * straight to Downloads has none of those failure modes.
 *
 * jsPDF is loaded on demand — it is bigger than the rest of the app's UI code
 * put together, and most sessions never ask for a report. The import below is
 * inside the function on purpose; do not hoist it.
 *
 * The page mirrors the app: the membership card from the profile panel as a
 * header, tactile summary cards, a ruled table with each row's own colour down
 * its left edge. Standard PDF fonts (Helvetica) rather than the app's display
 * face, because embedding a webfont would add several hundred kilobytes to a
 * document whose whole point is being small enough to email.
 */

import { downloadBlob, reportFilename } from './reports'

/* Millimetres, A4 portrait. */
const PAGE = { w: 210, h: 297, margin: 12 }
const CONTENT_W = PAGE.w - PAGE.margin * 2

/* The app's palette, as jsPDF wants it. */
const INK = [27, 25, 21]
const INK_500 = [110, 102, 89]
const INK_400 = [148, 139, 123]
const INK_300 = [189, 180, 162]
const CREAM_50 = [255, 253, 247]
const CREAM_100 = [253, 247, 234]
const CREAM_200 = [247, 237, 216]
const LIME = [198, 243, 43]
const HAIRLINE = [223, 216, 200]

const TILES = [
  { bg: [198, 243, 43], edge: [101, 127, 4] },
  { bg: [255, 158, 133], edge: [179, 46, 19] },
  { bg: [255, 203, 107], edge: [224, 134, 0] },
  { bg: [111, 217, 194], edge: [12, 143, 123] },
  { bg: [230, 255, 148], edge: [140, 179, 0] },
]

/** Same initials the app's Avatar shows. */
function initialsOf(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Same tile colour, by the same hash. */
function tileFor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % 997
  return TILES[hash % TILES.length]
}

function hexToRgb(hex) {
  const clean = String(hex ?? '').replace('#', '')
  if (clean.length !== 6) return INK_300
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/**
 * The standard PDF fonts are encoded WinAnsi, which covers Latin-1 and the
 * usual typographic punctuation but has no rupee sign — ₹ would come out as a
 * wrong glyph in every amount. Spelling it "Rs" is the honest trade against
 * embedding a Unicode font in a document meant to be emailed.
 */
function pdfText(value) {
  return String(value ?? '').replace(/₹\s?/g, 'Rs ')
}

/** 45° hatching, clamped to a box by hand — jsPDF has no clip we can rely on. */
function stripes(doc, x, y, w, h, spacing = 3) {
  for (let offset = -h; offset < w; offset += spacing) {
    let x1 = x + offset
    let y1 = y + h
    let x2 = x + offset + h
    let y2 = y

    if (x1 < x) {
      y1 -= x - x1
      x1 = x
    }
    if (x2 > x + w) {
      y2 += x2 - (x + w)
      x2 = x + w
    }
    if (x1 < x2) doc.line(x1, y1, x2, y2)
  }
}

/**
 * Build and save the PDF.
 *
 * @returns {Promise<string>} the filename it saved as
 */
export async function downloadReportPDF(options) {
  const doc = await buildReportDoc(options)
  const filename = reportFilename(options.kind, options.from, options.to, 'pdf')
  downloadBlob(filename, doc.output('blob'))
  return filename
}

/**
 * The document itself, with no browser in it.
 *
 * Split from the download above so the layout can be built and inspected
 * outside a page — the drawing is all arithmetic, and arithmetic is worth being
 * able to check without a print dialog.
 */
export async function buildReportDoc({
  report,
  rows,
  rangeLabel,
  userName = '',
  userEmail = '',
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const generatedAt = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const afterHeader = drawHeader(doc, { report, rangeLabel, userName, userEmail, rows })
  const afterCards = drawSummary(doc, report.summary, afterHeader + 5)

  // autoTable is handed down rather than reached for: it arrives from the
  // dynamic import above and exists nowhere else in this module's scope.
  drawTable(doc, autoTable, { report, rows, startY: afterCards + 4, generatedAt })

  // Page numbers can only be stamped once the page count is known.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...INK_400)
    doc.text(`Page ${page} of ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 9, { align: 'right' })
  }

  return doc
}

/** The membership card, lifted from the profile panel. */
function drawHeader(doc, { report, rangeLabel, userName, userEmail, rows }) {
  const x = PAGE.margin
  const y = PAGE.margin
  const h = 44
  const tile = tileFor(userName)

  // Card body and its lime band. The band is drawn as a rounded rect with the
  // bottom corners squared off by a second rect, which is the shortest way to
  // get one rounded end without a clipping path.
  doc.setFillColor(...CREAM_50)
  doc.roundedRect(x, y, CONTENT_W, h, 4, 4, 'F')

  doc.setFillColor(...LIME)
  doc.roundedRect(x, y, CONTENT_W, 13, 4, 4, 'F')
  doc.rect(x, y + 9, CONTENT_W, 4, 'F')

  doc.setDrawColor(160, 196, 35)
  doc.setLineWidth(0.2)
  stripes(doc, x, y, CONTENT_W, 13)

  doc.setDrawColor(...INK)
  doc.setLineWidth(0.7)
  doc.roundedRect(x, y, CONTENT_W, h, 4, 4, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(90, 84, 70)
  doc.text(`ZEPHR  ·  ${pdfText(report.subtitle).toUpperCase()}`, x + CONTENT_W - 5, y + 8, {
    align: 'right',
  })

  // Monogram, punched through the band on a cream ring.
  const tileX = x + 7
  const tileY = y + 5
  doc.setFillColor(...CREAM_50)
  doc.roundedRect(tileX - 1.4, tileY - 1.4, 18.8, 18.8, 6, 6, 'F')
  doc.setFillColor(...tile.edge)
  doc.roundedRect(tileX, tileY + 1.2, 16, 16, 5, 5, 'F')
  doc.setFillColor(...tile.bg)
  doc.roundedRect(tileX, tileY, 16, 16, 5, 5, 'F')
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.5)
  doc.roundedRect(tileX, tileY, 16, 16, 5, 5, 'S')

  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(initialsOf(userName), tileX + 8, tileY + 8, { align: 'center', baseline: 'middle' })

  const textX = tileX + 22

  doc.setFontSize(6.5)
  doc.setTextColor(...INK_400)
  doc.text('REPORT FOR', textX, y + 13)

  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text(pdfText(userName || 'You'), textX, y + 20)

  if (userEmail) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK_400)
    doc.text(pdfText(userEmail), textX, y + 24.5)
  }

  // Perforation.
  doc.setDrawColor(...INK_300)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(x + 6, y + 30, x + CONTENT_W - 6, y + 30)
  doc.setLineDashPattern([], 0)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(pdfText(report.title), x + 6, y + 37)

  doc.setFontSize(7.5)
  doc.setTextColor(...INK_400)
  doc.text(
    `${pdfText(report.subtitle)}  ·  ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
    x + 6,
    y + 41
  )

  // Range pill, sized to its own text.
  doc.setFontSize(8)
  const label = pdfText(rangeLabel)
  const pillW = doc.getTextWidth(label) + 9
  const pillX = x + CONTENT_W - 6 - pillW
  const pillY = y + 32

  doc.setFillColor(...LIME)
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.5)
  doc.roundedRect(pillX, pillY, pillW, 8, 4, 4, 'FD')
  doc.setTextColor(...INK)
  doc.text(label, pillX + pillW / 2, pillY + 4, { align: 'center', baseline: 'middle' })

  return y + h
}

/** The summary cards, three across. */
function drawSummary(doc, summary, startY) {
  if (!summary?.length) return startY

  const perRow = 3
  const gap = 3
  const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow
  const cardH = 17
  let y = startY

  summary.forEach((item, index) => {
    const column = index % perRow
    if (column === 0 && index > 0) y += cardH + gap

    const x = PAGE.margin + column * (cardW + gap)

    doc.setFillColor(...CREAM_50)
    doc.setDrawColor(...HAIRLINE)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, y, cardW, cardH, 3.5, 3.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...INK_400)
    doc.text(pdfText(item.label).toUpperCase(), x + 3.5, y + 5)

    doc.setFontSize(11.5)
    doc.setTextColor(...INK)
    doc.text(pdfText(item.value), x + 3.5, y + 11)

    if (item.hint) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...INK_300)
      doc.text(pdfText(item.hint), x + 3.5, y + 14.5)
    }
  })

  return y + cardH
}

/** The rows, grouped by day, with each row's colour down its left edge. */
function drawTable(doc, autoTable, { report, rows, startY, generatedAt }) {
  const columns = report.columns
  const lastColumn = columns.length - 1

  // autoTable is handed a flat body; `tabs` remembers which colour belongs to
  // which body index, since a group heading has none.
  const body = []
  const tabs = []

  const pushRow = (row) => {
    body.push(
      columns.map((column) => pdfText(column.print ? column.print(row) : row[column.key] ?? ''))
    )
    tabs.push(report.accent ? report.accent(row) : null)
  }

  if (report.groups?.length) {
    for (const group of report.groups) {
      body.push([
        { content: pdfText(group.label).toUpperCase(), colSpan: lastColumn || 1, styles: groupStyle() },
        { content: pdfText(group.meta ?? ''), styles: { ...groupStyle(), halign: 'right' } },
      ])
      tabs.push(null)
      group.rows.forEach(pushRow)
    }
  } else {
    rows.forEach(pushRow)
  }

  const columnStyles = {}
  columns.forEach((column, index) => {
    if (column.align === 'right') columnStyles[index] = { halign: 'right', fontStyle: 'bold' }
  })

  autoTable(doc, {
    head: [columns.map((column) => column.label.toUpperCase())],
    body,
    startY,
    margin: { top: PAGE.margin, right: PAGE.margin, bottom: 16, left: PAGE.margin },
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 3.4 },
      lineColor: HAIRLINE,
      lineWidth: 0.15,
      textColor: INK,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: CREAM_200,
      textColor: INK_500,
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 3.4 },
    },
    alternateRowStyles: { fillColor: CREAM_100 },
    columnStyles,
    // The tab: a bar of the row's own colour, drawn over the first cell's left
    // edge once the cell itself has been painted.
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return
      const tint = tabs[data.row.index]
      if (!tint) return
      doc.setFillColor(...hexToRgb(tint))
      doc.rect(data.cell.x + 0.15, data.cell.y + 0.15, 1.5, data.cell.height - 0.3, 'F')
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...INK_400)
      doc.setDrawColor(...INK_300)
      doc.setLineWidth(0.3)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(PAGE.margin, PAGE.h - 13, PAGE.w - PAGE.margin, PAGE.h - 13)
      doc.setLineDashPattern([], 0)
      doc.text(`Generated ${generatedAt}  ·  Zephr`, PAGE.margin, PAGE.h - 9)
    },
  })
}

function groupStyle() {
  return {
    fillColor: CREAM_200,
    textColor: INK,
    fontStyle: 'bold',
    fontSize: 7,
  }
}
