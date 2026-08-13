import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light or dark.
 *
 * Light is the app's default, full stop — Zephr is a cream app with lime on it,
 * that's what the design *is*, and it's what everyone should meet first. Dark
 * is available and it's remembered forever once chosen, but it is a choice
 * somebody makes, not a state they can be dropped into by a phone that flipped
 * itself at sunset.
 *
 * So the OS preference is deliberately not consulted. This used to follow
 * `prefers-color-scheme` until a choice was made, which meant the same account
 * looked like two different apps depending on the device and the hour, and a
 * user who never asked for dark mode got it anyway.
 *
 * The class on <html> is the source of truth for CSS (see index.css, where the
 * whole palette hangs off `.dark`). This module owns writing it — and the first
 * write happens before React exists at all, in the inline script in index.html,
 * so the app never paints cream and then snaps to black.
 *
 * No context provider: the theme is one boolean shared by the entire tree, it
 * changes maybe twice a year, and wrapping the app in a provider to broadcast
 * it would re-render every module on every toggle. `useSyncExternalStore` over
 * a module-level store gives components the value without any of that.
 */

const STORAGE_KEY = 'zephr:theme'
const THEMES = new Set(['light', 'dark'])

// Kept in step with the meta tag in index.html: the browser paints this behind
// the status bar and the pull-to-refresh overscroll, and a cream strip above a
// black page is the sort of seam you only notice on someone else's app.
const BAR_COLOR = { light: '#FDF7EA', dark: '#15130F' }

const listeners = new Set()

/** What the user has explicitly asked for, or null if they never have. */
function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.has(stored) ? stored : null
  } catch {
    // Private mode, or storage disabled. The theme still works for this
    // session; it just won't be remembered, which is the right failure.
    return null
  }
}

/** The default, and the only thing an unset preference can mean. */
const DEFAULT_THEME = 'light'

function resolve() {
  return readPreference() ?? DEFAULT_THEME
}

// A plain string, which is all useSyncExternalStore's identity check needs now
// that the resolved theme is the whole story — it used to also have to carry
// *where* the theme came from, because "dark" meant something different when
// the OS had chosen it.
function snapshot() {
  return resolve()
}

function apply(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BAR_COLOR[theme])
}

function emit() {
  apply(resolve())
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)

  // No `prefers-color-scheme` listener: the OS doesn't get a vote, so a phone
  // flipping itself to dark at sunset must not move a page that's open.

  // Two tabs open on Zephr should agree. `storage` only fires in the *other*
  // tabs, which is exactly what's wanted.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) emit()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Set the theme, or pass `null` to clear the choice and fall back to the
 * default. Exported on its own for anything that wants to flip the theme
 * without subscribing to it.
 */
export function setTheme(next) {
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY)
    else if (THEMES.has(next)) localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Unstorable: apply it for this session anyway. See readPreference.
  }
  emit()
}

export function useTheme() {
  // The server snapshot is only ever read if this app is prerendered, and it
  // agrees with the default the inline boot script assumes.
  const theme = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_THEME)

  const toggle = useCallback(() => {
    setTheme(resolve() === 'dark' ? 'light' : 'dark')
  }, [])

  return {
    /** 'light' | 'dark' — what's actually on screen right now. */
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggle,
  }
}
