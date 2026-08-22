/**
 * One note, as a sheet of paper.
 *
 * The report PDF (utils/reportPdf.js) prints a ledger: a membership-card
 * header, summary tiles, a striped table. A note is not a ledger and printing
 * it like one would be a category error — so this draws what the note already
 * is on screen. Cream stock, feint rules at a fixed pitch, one red margin rule
 * down the left, the note's own colour across the top edge, and the writing
 * sitting *on* the lines. A checklist keeps its boxes, drawn rather than
 * spelled `[x]`, because a printed to-do list you can tick with a pen is the
 * entire reason to print one.
 *
 * jsPDF is loaded on demand, as in reportPdf — it's larger than the rest of the
 * app's UI code put together and most sessions never ask for a file. The import
 * lives inside the function on purpose; do not hoist it.
 *
 * Standard PDF fonts (Helvetica) rather than the app's display face, for the
 * same reason as the report: embedding a webfont would add several hundred
 * kilobytes to a document whose point is being small enough to email. That
 * choice costs something here it doesn't cost there — a note can contain
 * anything a keyboard can type — which is why `unsupportedGlyphs` exists in
 * noteExport, and why the sheet warns before the download rather than leaving
 * someone holding a page with holes in it.
 */

import { downloadBlob } from './reports'
import { getColor, parseNoteBody } from './noteHelpers'
import { headingFor, isTodo, noteFilename, pdfText, progressLabel } from './noteExport'

/* Millimetres, A4 portrait. */
const PAGE = { w: 210, h: 297, margin: 12 }
const CONTENT_W = PAGE.w - PAGE.margin * 2

/** The pitch of the ruling, and therefore the line height. One or the other. */
const RULE = 7.2
/** Paper edge → red margin rule, matching `--rule-gutter` on screen. */
const GUTTER = 17
/** How far down the first page the writing starts when there's no heading. */
const BAND_H = 11

const INK = [27, 25, 21]
const INK_400 = [148, 139, 123]
const INK_300 = [189, 180, 162]
const CREAM_50 = [255, 253, 247]
const RULE_INK = [223, 218, 206]
const RULE_RED = [242, 176, 160]
const LIME = [198, 243, 43]

function hexToRgb(hex) {
  const clean = String(hex ?? '').replace('#', '')
  if (clean.length !== 6) return INK_300
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/* ── The page ────────────────────────────────────────────────────────────── */

/**
 * A blank sheet: stock, ruling, margin rule, and the border.
 *
 * Drawn before anything else on the page, because the stock is a filled
 * rectangle the size of the sheet and would paint over whatever it followed.
 * Called once per page rather than once per document — a note that runs to
 * three pages is three sheets off the same pad, and a second page of unruled
 * white would look like the file had given up.
 *
 * Returns the y of the last rule the writing may sit on.
 */
function drawSheet(doc, firstRuleY) {
  const x = PAGE.margin
  const y = PAGE.margin
  const h = PAGE.h - PAGE.margin * 2

  doc.setFillColor(...CREAM_50)
  doc.roundedRect(x, y, CONTENT_W, h, 4, 4, 'F')

  // Feint rules, stopping short of the footer so the last line of writing isn't
  // sitting on the printed-on stamp.
  const bottom = y + h - 12
  doc.setDrawColor(...RULE_INK)
  doc.setLineWidth(0.2)
  for (let line = firstRuleY; line <= bottom; line += RULE) {
    doc.line(x + 2, line, x + CONTENT_W - 2, line)
  }

  // The margin rule, red, running the height of the ruled area.
  doc.setDrawColor(...RULE_RED)
  doc.setLineWidth(0.45)
  doc.line(x + GUTTER, firstRuleY - RULE, x + GUTTER, bottom)

  doc.setDrawColor(...INK)
  doc.setLineWidth(0.7)
  doc.roundedRect(x, y, CONTENT_W, h, 4, 4, 'S')

  return bottom
}

/** The note's own colour across the top edge, and what kind of thing this is. */
function drawBand(doc, note) {
  const x = PAGE.margin
  const y = PAGE.margin
  const color = getColor(note.color)

  // Rounded top corners, squared bottom — a rounded rect with a plain one over
  // its lower half, the same trick the report header uses.
  doc.setFillColor(...hexToRgb(color.tape))
  doc.roundedRect(x, y, CONTENT_W, BAND_H, 4, 4, 'F')
  doc.rect(x, y + BAND_H - 4, CONTENT_W, 4, 'F')

  doc.setDrawColor(...INK)
  doc.setLineWidth(0.4)
  doc.line(x, y + BAND_H, x + CONTENT_W, y + BAND_H)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...INK)
  doc.text('ZEPHR', x + 6, y + 7)
  doc.text(isTodo(note) ? 'TO-DO LIST' : 'NOTE', x + CONTENT_W - 6, y + 7, { align: 'right' })
}

/**
 * Where the heading will sit, worked out before the paper is drawn.
 *
 * Measuring and drawing are separate because the ruling has to start on a whole
 * rule below the title, and the paper has to be painted before the title —
 * so the height has to be known one step before it can be used.
 *
 * The heading is allowed two lines and then truncates: a title long enough to
 * need three is a body pretending to be a title, and letting it push the
 * writing down the page would cost a line of the thing you actually printed.
 */
function measureHeading(doc, note) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  const title = doc.splitTextToSize(pdfText(headingFor(note)), CONTENT_W - 12).slice(0, 2)

  const meta = pdfText(
    [
      (note.tags ?? []).map((tag) => `#${tag}`).join('  '),
      note.pinned ? 'pinned' : '',
      progressLabel(note),
      stamp(note.updated_at),
    ]
      .filter(Boolean)
      .join('   ·   ')
  )

  const top = PAGE.margin + BAND_H + 11
  const bottom = top + (title.length - 1) * 7.5 + (meta ? 6 : 0)
  return { title, meta, top, bottom }
}

function drawHeading(doc, { title, meta, top }) {
  const x = PAGE.margin + 6
  let y = top

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...INK)
  for (const line of title) {
    doc.text(line, x, y)
    y += 7.5
  }

  if (!meta) return
  doc.setFontSize(8)
  doc.setTextColor(...INK_400)
  doc.text(meta, x, y - 1.5)
}

function stamp(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return timestamp ? `updated ${label}` : `printed ${label}`
}

/** An empty tick box, or a ticked one — drawn, so a pen can finish the job. */
function drawBox(doc, x, y, done) {
  const size = 3.6
  const top = y - size + 0.6

  doc.setFillColor(...(done ? LIME : CREAM_50))
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.35)
  doc.roundedRect(x, top, size, size, 0.8, 0.8, 'FD')

  if (!done) return
  doc.setLineWidth(0.5)
  doc.setDrawColor(...INK)
  doc.line(x + 0.9, top + 1.9, x + 1.6, top + 2.7)
  doc.line(x + 1.6, top + 2.7, x + 2.9, top + 0.9)
}

/* ── The document ────────────────────────────────────────────────────────── */

/**
 * Build the whole thing.
 *
 * Split from the download below so the layout can be built and inspected
 * outside a browser — it's all arithmetic, and arithmetic is worth being able
 * to check without a print dialog.
 */
export async function buildNoteDoc(note) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Measure, paint the paper, then put the heading on it — in that order, or
  // the stock covers the writing.
  const heading = measureHeading(doc, note)
  // The first rule is the first whole multiple of the pitch clear of the title.
  let firstRule =
    PAGE.margin + Math.ceil((heading.bottom + 5 - PAGE.margin) / RULE) * RULE
  let bottom = drawSheet(doc, firstRule)
  drawBand(doc, note)
  drawHeading(doc, heading)

  // Everything sits to the right of the red margin rule, the way writing does
  // on a pad. A tick box takes the place prose starts at and pushes its own
  // text across; a wrapped task line then indents under that text rather than
  // running back under the box.
  const proseX = PAGE.margin + GUTTER + 2
  const boxX = proseX
  const textX = proseX + 5.6
  const textW = PAGE.margin + CONTENT_W - 5 - textX

  // Baselines sit just above the rule, the way writing sits on a line.
  let y = firstRule - 1.8

  const nextPage = () => {
    doc.addPage()
    firstRule = PAGE.margin + RULE * 2
    bottom = drawSheet(doc, firstRule)
    y = firstRule - 1.8
  }

  for (const line of parseNoteBody(note.body)) {
    const text = pdfText(line.text.trim())
    const task = line.type === 'task'

    // A blank line is a paragraph break: it costs one rule and draws nothing.
    if (!text) {
      y += RULE
      if (y > bottom) nextPage()
      continue
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    const x = task ? textX : proseX
    // A wrapped task line indents under its own text, not back under the box.
    const wrapped = doc.splitTextToSize(text, task ? textW : textW + 2.5)

    wrapped.forEach((part, index) => {
      if (y > bottom) nextPage()

      if (task && index === 0) drawBox(doc, boxX, y, line.done)

      // A ticked item is greyed and struck through rather than dropped — the
      // same "done, still visible" the card does, which is the point of ticking
      // something instead of deleting it.
      doc.setTextColor(...(task && line.done ? INK_400 : INK))
      doc.text(part, x, y)

      if (task && line.done) {
        doc.setDrawColor(...INK_400)
        doc.setLineWidth(0.35)
        doc.line(x, y - 1.2, x + doc.getTextWidth(part), y - 1.2)
      }

      y += RULE
    })
  }

  stampFooters(doc)
  return doc
}

/** The provenance line and page numbers, once the page count is known. */
function stampFooters(doc) {
  const pages = doc.getNumberOfPages()
  const printed = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...INK_400)
    doc.text(`Zephr  ·  printed ${printed}`, PAGE.margin + 6, PAGE.h - PAGE.margin - 4)
    if (pages > 1) {
      doc.text(`Page ${page} of ${pages}`, PAGE.margin + CONTENT_W - 6, PAGE.h - PAGE.margin - 4, {
        align: 'right',
      })
    }
  }
}

/**
 * Build it and hand it to the browser.
 *
 * @returns {Promise<string>} the filename it saved as
 */
export async function downloadNotePDF(note) {
  const doc = await buildNoteDoc(note)
  const filename = noteFilename(note, 'pdf')
  downloadBlob(filename, doc.output('blob'))
  return filename
}
