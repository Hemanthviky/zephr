import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light or dark, and who decided.
 *
 * Three states, not two: `light`, `dark`, and *nothing chosen yet* — which
 * follows the operating system and keeps following it as it changes at sunset.
 * A user who has never opened the toggle should get the theme their phone is
 * already in; the moment they do touch it, that choice outranks the OS forever,
 * on that device.
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

/** What the user has explicitly asked for, or null while they're following the OS. */
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

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve() {
  return readPreference() ?? systemTheme()
}

// One string, so useSyncExternalStore's identity check does the right thing:
// "dark, and they picked it" is a different snapshot to "dark, following the OS",
// and the toggle wants to know which.
function snapshot() {
  return `${resolve()}:${readPreference() ?? 'system'}`
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

  // Only relevant while the user is following the OS — but subscribing
  // unconditionally is cheaper than tearing the listener down and rebuilding it
  // every time the preference changes, and `emit` re-reads the preference
  // anyway, so an OS flip while pinned to light is a no-op.
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (readPreference() === null) emit()
  }
  media?.addEventListener('change', onSystemChange)

  // Two tabs open on Zephr should agree. `storage` only fires in the *other*
  // tabs, which is exactly what's wanted.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) emit()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Set the theme, or pass `null` to hand the decision back to the OS.
 * Exported on its own for anything that wants to flip the theme without
 * subscribing to it.
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
  // The server snapshot is only ever read if this app is prerendered; light is
  // the honest answer, since there's no OS to ask.
  const value = useSyncExternalStore(subscribe, snapshot, () => 'light:system')
  const [theme, preference] = value.split(':')

  const toggle = useCallback(() => {
    setTheme(resolve() === 'dark' ? 'light' : 'dark')
  }, [])

  return {
    /** 'light' | 'dark' — what's actually on screen right now. */
    theme,
    isDark: theme === 'dark',
    /** 'light' | 'dark' | 'system' — where that came from. */
    preference,
    setTheme,
    toggle,
  }
}
