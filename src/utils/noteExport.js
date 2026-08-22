/**
 * Taking one thing off the board.
 *
 * Notes are the one module with no report panel, because a report is a range of
 * a ledger and a pinboard has neither. What it does have is the thing people
 * actually ask a notes app for: give me that back, in a file, that opens
 * somewhere that isn't you.
 *
 * One note per file, deliberately. A single archive of the whole board is the
 * export nobody wants twice — you download it to get at the shopping list, and
 * then you're holding forty other things you have to dig through. So there is
 * no "everything" button anywhere in here: you pick the note you mean, or you
 * open it and save it, and what lands in your downloads is that note.
 *
 * A saved login never leaves. `kind === 'secret'` is dropped in `exportable`,
 * the one function the picker's list is built from, and the plaintext isn't
 * even reachable from this module — decryption needs the vault key, which only
 * Notes.jsx holds — so a password in an export would have to be deliberately
 * plumbed in from two files away.
 */

import { formatFullDate, toISODate, todayISO } from './dateHelpers'
import { buildCSV, downloadBlob, downloadCSV } from './reports'
import { checklistStats, hasChecklist, parseNoteBody, sortNotes } from './noteHelpers'

/* ── What can be exported at all ─────────────────────────────────────────── */

/** Every note that isn't a saved login, pinned first — the single gate. */
export function exportable(notes) {
  return sortNotes((notes ?? []).filter((note) => note.kind !== 'secret'))
}

/**
 * Is this a to-do list?
 *
 * By content, not by a column — a note with tick boxes in it *is* a list, which
 * is the rule the board's own "To-do" filter already uses. Both this and the
 * filter therefore agree about every note, which is what stops the picker from
 * disagreeing with the board behind it.
 */
export function isTodo(note) {
  return hasChecklist(note.body)
}

/* ── Naming the file ─────────────────────────────────────────────────────── */

/**
 * What to call a note that has to be a filename and a row in a list.
 *
 * A title if there is one; otherwise the first line, which is what the card on
 * the board shows and what you'd have called it anyway. An untitled *list* gets
 * "To-do: milk" rather than "milk", because the bare item would name the file
 * after something that is also the first line inside it — and in a downloads
 * folder, "To-do: milk" is the one you can pick out.
 */
export function headingFor(note) {
  const title = String(note.title ?? '').trim()
  if (title) return title

  const first = parseNoteBody(note.body).find((line) => line.text.trim())
  if (!first) return isTodo(note) ? 'To-do list' : 'Untitled'

  const text = first.text.trim().slice(0, 80)
  return isTodo(note) ? `To-do: ${text}` : text
}

/**
 * `zephr-shopping-list-2026-08-22.md`.
 *
 * The note's own name is in the filename because that's the only thing that
 * tells two exports apart in a downloads folder, and the date is there so a
 * second save of the same note doesn't silently become "(1)". Everything that
 * isn't a letter or a digit collapses to a hyphen — including the characters
 * Windows outright refuses in a filename, which a note title is free to
 * contain and a download would otherwise fail on.
 */
export function noteFilename(note, extension, today = todayISO()) {
  const slug = headingFor(note)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')

  return `zephr-${slug || 'note'}-${today}.${extension}`
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

/** A row timestamp as the calendar day it happened on, locally. */
function dayOf(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : toISODate(date)
}

function longDay(timestamp) {
  const iso = dayOf(timestamp)
  return iso ? formatFullDate(iso) : ''
}

/** "3/7 done", for a list. Empty for anything without boxes. */
export function progressLabel(note) {
  const { done, total } = checklistStats(note.body)
  return total > 0 ? `${done}/${total} done` : ''
}

/* ── What a PDF can actually hold ────────────────────────────────────────── */

/**
 * WinAnsi: the encoding the standard PDF fonts use, which is what utils/notePdf
 * draws with. ASCII, Latin-1, and the handful of typographic characters in the
 * 0x80 block — curly quotes, dashes, the bullet, the ellipsis. Everything else
 * — emoji, Tamil, Devanagari, CJK, the rupee sign — has no glyph in Helvetica
 * and would come out blank or wrong.
 *
 * This lives here rather than beside the drawing code so the picker can ask the
 * question without pulling the PDF module (and jsPDF behind it) into the page
 * for everyone who never taps Save.
 */
const DRAWABLE =
  /[\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/

/** The same string, with the un-drawable dropped. ₹ becomes "Rs", as in reports. */
export function pdfText(value) {
  return String(value ?? '')
    .replace(/₹\s?/g, 'Rs ')
    .split('')
    .filter((char) => DRAWABLE.test(char))
    .join('')
}

/**
 * Which characters a PDF of this note would lose, if any.
 *
 * Asked before the button is offered, so "the emoji and the Tamil won't survive
 * a PDF" is said while Markdown is still one tap away — rather than discovered
 * later in a file full of holes.
 */
export function unsupportedGlyphs(note) {
  const text = `${note?.title ?? ''}\n${note?.body ?? ''}`.replace(/₹\s?/g, '')
  const lost = new Set()
  for (const char of text) {
    if (char.trim() && !DRAWABLE.test(char)) lost.add(char)
  }
  return [...lost]
}

/* ── Markdown ────────────────────────────────────────────────────────────── */

/**
 * The readable file.
 *
 * Markdown rather than plain text because the checklist syntax the app already
 * stores — `- [x] milk` — *is* Markdown, so a list exports byte for byte as
 * what you typed and still arrives as a working tick list in Obsidian, Notion,
 * GitHub or anything else that renders it. A note's body needs no
 * transformation for the same reason: it goes out exactly as it went in.
 *
 * The title is the document's `#`, not a section inside it, because the file is
 * one note — nesting it under a wrapper heading would be a table of contents
 * for a table of one.
 */
export function buildNoteMarkdown(note, today = todayISO()) {
  const meta = [
    (note.tags ?? []).map((tag) => `#${tag}`).join(' '),
    note.pinned ? 'pinned' : '',
    progressLabel(note),
    longDay(note.updated_at) ? `updated ${longDay(note.updated_at)}` : `saved ${formatFullDate(today)}`,
  ].filter(Boolean)

  const out = [`# ${headingFor(note)}`]
  if (meta.length > 0) out.push('', `*${meta.join(' · ')}*`)

  const body = bodyBelowHeading(note)
  if (body.trim()) out.push('', '---', '', body)

  // One trailing newline: a file that ends mid-line annoys every tool it will
  // ever meet.
  return `${out.join('\n')}\n`
}

/**
 * The body, minus the line the heading was borrowed from.
 *
 * An untitled note takes its first line as its name — that's what the card on
 * the board does — and printing that line again immediately under the `#` reads
 * as a stutter in a file nobody can go back and fix. A list never borrows and
 * so never loses a line here: the first item of a to-do list is a to-do, and
 * promoting it into a heading is how you lose the milk.
 */
function bodyBelowHeading(note) {
  const body = String(note.body ?? '').replace(/\s+$/, '')
  if (String(note.title ?? '').trim() || isTodo(note)) return body

  const lines = body.split('\n')
  let cut = 0
  while (cut < lines.length && !lines[cut].trim()) cut += 1
  // The heading is that line; drop it and any blank run that followed it.
  cut += 1
  while (cut < lines.length && !lines[cut].trim()) cut += 1
  return lines.slice(cut).join('\n')
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/**
 * A list, one row per line.
 *
 * The shape a spreadsheet is worth opening for: sorting and filtering by what's
 * still outstanding needs the *item* to be the row. `Done` is yes/no for a tick
 * box and empty for a plain line, so prose sitting inside a checklist ("ask
 * about the deposit") still comes across rather than being quietly dropped,
 * while filtering the column to `no` gives exactly what's left.
 */
const TASK_COLUMNS = [
  { label: 'Item', csv: (row) => row.text },
  { label: 'Done', csv: (row) => row.done },
]

/**
 * A note, one row per line as well — same reason in reverse.
 *
 * Putting a whole note in a single cell technically works and is unreadable:
 * spreadsheets don't grow a cell to fit six paragraphs, they hide five of them
 * behind a row height nobody adjusts. A line per row is at least legible in the
 * column, and pastes back out as the note.
 */
const LINE_COLUMNS = [{ label: 'Line', csv: (row) => row.text }]

function lineRows(note) {
  return parseNoteBody(note.body)
    .filter((line) => line.text.trim())
    .map((line) => ({
      text: line.text.trim(),
      done: line.type === 'task' ? (line.done ? 'yes' : 'no') : '',
    }))
}

export function buildNoteCSV(note) {
  const rows = lineRows(note)
  return isTodo(note) ? buildCSV(TASK_COLUMNS, rows) : buildCSV(LINE_COLUMNS, rows)
}

/** How many rows that CSV will have — the picker says so before you tap. */
export function noteRowCount(note) {
  return lineRows(note).length
}

/* ── The download itself ─────────────────────────────────────────────────── */

/**
 * One note, one file, straight to the downloads folder.
 *
 * Lives here rather than in either component because both ways of asking for it
 * — picking a note in the download sheet, or hitting save-a-copy on the note
 * you already have open — must produce identical files with the same name. Two
 * call sites building that separately is how they drift.
 *
 * Async only because of the PDF: jsPDF is several hundred kilobytes and is
 * fetched the first time somebody asks for one, never on page load. Markdown
 * and CSV resolve without awaiting anything, so a caller that ignores the
 * promise still behaves.
 *
 * Refuses a login outright. Nothing currently calls it with one; that's the
 * point of a guard that costs a line.
 */
export async function downloadNote(note, format = 'md') {
  if (!note || note.kind === 'secret') return false

  if (format === 'pdf') {
    // Imported here rather than at the top so the PDF code — and jsPDF behind
    // it — stays out of the Notes chunk for everyone who never taps it.
    const { downloadNotePDF } = await import('./notePdf')
    await downloadNotePDF(note)
    return true
  }

  if (format === 'csv') {
    downloadCSV(noteFilename(note, 'csv'), buildNoteCSV(note))
    return true
  }

  downloadBlob(
    noteFilename(note, 'md'),
    new Blob([buildNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8;' })
  )
  return true
}
