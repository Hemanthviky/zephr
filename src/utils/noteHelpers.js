/**
 * The board's own logic — colour, tilt, search and sort.
 *
 * Kept out of the components because all four are decisions about what the
 * board *is*, and three of them (tilt especially) have to give the same answer
 * every render or the wall visibly reshuffles itself on every keystroke.
 */

/**
 * The six papers.
 *
 * `paper` and `edge` are the card; `tape` is the strip pinning it to the board,
 * and it's the one that has to stay saturated — at the tints the cards use, six
 * backgrounds are nearly the same colour from across a room, and the tape is
 * what you actually pick a note out by.
 */
export const NOTE_COLORS = [
  { id: 'cream', label: 'Plain', paper: '#FFFDF7', edge: '#EFE0C2', tape: '#E2CDA4' },
  { id: 'sand', label: 'Sand', paper: '#F7EDD8', edge: '#E2CDA4', tape: '#C9A96B' },
  { id: 'lime', label: 'Lime', paper: '#F2FFC7', edge: '#D8FC5E', tape: '#AEDC0B' },
  { id: 'tangerine', label: 'Amber', paper: '#FFEFCE', edge: '#FFCB6B', tape: '#FFA51F' },
  { id: 'coral', label: 'Coral', paper: '#FFE4DC', edge: '#FF9E85', tape: '#FF5A38' },
  { id: 'avocado', label: 'Mint', paper: '#D6F5EC', edge: '#6FD9C2', tape: '#12B39A' },
]

const COLOR_BY_ID = new Map(NOTE_COLORS.map((color) => [color.id, color]))

export function getColor(id) {
  return COLOR_BY_ID.get(id) ?? NOTE_COLORS[0]
}

/**
 * How far a note hangs off true, in degrees.
 *
 * A wall of perfectly square cards reads as a spreadsheet; a wall of randomly
 * rotated ones reads as a mess and, worse, re-randomises on every render. So
 * the angle is a hash of the note's own id — stable for the life of the note,
 * different from its neighbours, and never more than about a degree and a half,
 * which is the difference between "pinned by hand" and "broken".
 *
 * Pinned notes are excluded by the caller: a drawing pin through the top of a
 * card is exactly the thing that would hold it straight.
 */
export function tiltFor(id) {
  let hash = 0
  const key = String(id)
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  // 7 buckets, centred on zero, so a few notes sit square and the rest lean.
  return ((Math.abs(hash) % 7) - 3) * 0.5
}

/** Tags: comma or space separated in, lowercase and de-duplicated out. */
export function parseTags(input) {
  const seen = new Set()
  for (const raw of String(input ?? '').split(/[,\n]/)) {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').slice(0, 24)
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, 8)
}

/**
 * The extra fields a login carries beyond username and password.
 *
 * A saved login is a JSON payload encrypted as one blob, which is what makes
 * this possible at all: an arbitrary named field costs no column, no migration
 * and no second round trip — the shape lives entirely inside the ciphertext.
 * Older logins simply have no `fields` key, and read back as none.
 *
 * `hidden` is the field's own choice about the board: a PIN or a security answer
 * wants the same redaction bar the password gets, an account number usually
 * doesn't. Normalising here rather than in the sheet means the card can trust
 * what it renders even if the blob was written by an older build.
 */
export const MAX_SECRET_FIELDS = 8
export const SECRET_FIELD_LABEL_MAX = 32
export const SECRET_FIELD_VALUE_MAX = 500

export function normalizeSecretFields(fields) {
  if (!Array.isArray(fields)) return []

  const out = []
  for (const entry of fields) {
    if (!entry || typeof entry !== 'object') continue

    const label = String(entry.label ?? '').trim().slice(0, SECRET_FIELD_LABEL_MAX)
    const value = String(entry.value ?? '').slice(0, SECRET_FIELD_VALUE_MAX)
    // A row the user added and never filled in is not a field.
    if (!label && !value.trim()) continue

    out.push({ label: label || 'Field', value, hidden: Boolean(entry.hidden) })
    if (out.length >= MAX_SECRET_FIELDS) break
  }
  return out
}

/** Every tag on the board, most-used first — the filter row is built from this. */
export function collectTags(notes) {
  const counts = new Map()
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }))
}

/**
 * Does this note match what's in the search box?
 *
 * Titles, bodies and tags — never the secret. A locked note is searchable by
 * the label on the outside of the envelope and nothing else, which is the
 * honest consequence of the server never holding the plaintext.
 */
export function matchesQuery(note, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = [
    note.title,
    note.kind === 'secret' ? '' : note.body,
    ...(note.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()

  // Every word has to appear somewhere, in any order — "bank pin" finds a note
  // titled "PIN — bank card", which a substring match would miss.
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

/** Pinned to the top, then most recently touched. */
export function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
  })
}

/**
 * "just now", "12m", "3h", "Tue", "4 Aug".
 *
 * Short on purpose: it sits in the corner of a card next to a pin and a colour
 * swatch, and "2 hours ago" is three times the width of "2h" for no extra
 * meaning at that size.
 */
export function shortAgo(timestamp) {
  if (!timestamp) return ''
  const then = new Date(timestamp)
  if (Number.isNaN(then.getTime())) return ''

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 7 * 86_400) return then.toLocaleDateString(undefined, { weekday: 'short' })

  const sameYear = then.getFullYear() === new Date().getFullYear()
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
  })
}

/**
 * The first line of a note, for the card's own heading when it has no title.
 *
 * A note you dashed off without a title should still be identifiable on the
 * board, and its first line is what you'd have called it anyway.
 */
export function firstLine(body, limit = 60) {
  const line = String(body ?? '').split('\n').find((text) => text.trim())
  if (!line) return ''
  const trimmed = line.trim()
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed
}

/** What a card shows under its title — the body, minus the line already used. */
export function bodyPreview(note) {
  if (!note.body) return ''
  const lines = String(note.body).split('\n')
  if (note.title.trim()) return lines.join('\n').trim()
  const [, ...rest] = lines
  return rest.join('\n').trim()
}

/**
 * 'accounts.google.com' out of whatever was pasted into the URL field.
 *
 * People paste the whole address bar, and a vault card that reads
 * "https://accounts.google.com/signin/v2/identifier?flowName=…" is unreadable
 * at card width. Bare hostnames get typed too, hence the second attempt.
 */
export function hostOf(url) {
  const value = String(url ?? '').trim()
  if (!value) return ''
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    try {
      return new URL(`https://${value}`).hostname.replace(/^www\./, '')
    } catch {
      return value.slice(0, 40)
    }
  }
}

/** The same value, safe to hand to an anchor. Bare hosts get a scheme. */
export function hrefOf(url) {
  const value = String(url ?? '').trim()
  if (!value) return ''
  // Anything that isn't plainly http(s) is not a link — `javascript:` in a
  // field the user pastes into is an XSS waiting for the next careless render.
  if (/^https?:\/\//i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`
  return ''
}

/**
 * Copy to the clipboard, and say whether it worked.
 *
 * The async Clipboard API is the whole story on a modern secure origin, but it
 * is absent over plain http, so the ancient execCommand path stays as a
 * fallback — otherwise "Copy password" silently does nothing on a LAN address,
 * which is the single most infuriating way for a password manager to fail.
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the textarea trick */
  }

  try {
    const scratch = document.createElement('textarea')
    scratch.value = text
    scratch.setAttribute('readonly', '')
    scratch.style.position = 'fixed'
    scratch.style.opacity = '0'
    document.body.appendChild(scratch)
    scratch.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(scratch)
    return ok
  } catch {
    return false
  }
}
