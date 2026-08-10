/**
 * Date helpers for Zephr.
 *
 * Everything the app stores is a *calendar day in the user's own timezone* —
 * `date` in Postgres is a bare `date`, not a timestamp. That means we must never
 * round-trip through `toISOString()`, which converts to UTC and silently shifts
 * the day for anyone east or west of Greenwich (a 1am log in IST would land on
 * "yesterday"). All conversion below goes through local date parts instead.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n) => String(n).padStart(2, '0')

/** Date object → 'YYYY-MM-DD' using local calendar parts. */
export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'YYYY-MM-DD' → Date at local midnight. */
export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Today's calendar day, local. */
export function todayISO() {
  return toISODate(new Date())
}

/** Shift an ISO day by ±n days, staying on local midnight (DST safe). */
export function addDays(iso, n) {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function isToday(iso) {
  return iso === todayISO()
}

/** Guard for the date navigator — tomorrow doesn't exist yet. */
export function isFuture(iso) {
  return iso > todayISO()
}

/** Whole days between two ISO days (b - a), ignoring DST wobble. */
export function daysBetween(a, b) {
  return Math.round((fromISODate(b) - fromISODate(a)) / DAY_MS)
}

/**
 * Human label for the date header: "Today", "Yesterday", "Sat 8 Aug",
 * and a year suffix once we're outside the current year.
 */
export function formatDayLabel(iso) {
  const diff = daysBetween(todayISO(), iso)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'

  const d = fromISODate(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Secondary line under the big label, e.g. "9 August 2026". */
export function formatFullDate(iso) {
  return fromISODate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "Logged at 8:42 pm" for individual entries. */
export function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * "Good evening" — for greeting someone by name. Boundaries are the ordinary
 * ones people expect rather than anything clever, and the late-night branch
 * exists because "Good morning" at 1am reads as a bug.
 */
export function timeGreeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
