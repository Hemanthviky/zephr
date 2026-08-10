import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AuthLayout from './components/Auth/AuthLayout'
import LoginForm from './components/Auth/LoginForm'
import SignupForm from './components/Auth/SignupForm'
import Tracker from './components/Tracker/Tracker'
import TabBar from './components/shared/TabBar'
import Icon3D from './components/shared/Icon3D'
import NotFound from './components/Errors/NotFound'
import Offline from './components/Errors/Offline'
import CrashScreen from './components/Errors/CrashScreen'
import { useAuth } from './hooks/useAuth'
import { useOnline } from './hooks/useOnline'
import { isSupabaseConfigured } from './lib/supabaseClient'

// The Money tab pulls in recharts, which is heavier than everything else in the
// app combined. Split it out so opening Zephr to log a banana never downloads
// a charting library.
const ExpenseTracker = lazy(() => import('./components/Expenses/ExpenseTracker'))

// There's no router here — two tabs live behind one URL — so the entire routing
// question is "are you at the root or somewhere that doesn't exist". Read once
// at module load, because neither answer can change without a navigation.
const KNOWN_PATHS = new Set(['/', '/index.html'])
const PATH = typeof window === 'undefined' ? '/' : window.location.pathname
const IS_KNOWN_PATH = KNOWN_PATHS.has(PATH)

// ?preview=404 | crash | offline renders an error page on demand. These are the
// three screens you can't reach deliberately, and they're impossible to design
// or check without a way in.
const PREVIEW =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('preview')

export default function App() {
  const { user, loading, pending, error, notice, signIn, signUp, signOut, clearMessages } = useAuth()
  const [mode, setMode] = useState('login')
  const online = useOnline()
  const [ignoredOffline, setIgnoredOffline] = useState(false)

  // Reconnecting clears the dismissal, so a later drop gets announced again
  // rather than being silently swallowed for the rest of the session.
  useEffect(() => {
    if (online) setIgnoredOffline(false)
  }, [online])

  if (PREVIEW) {
    const page = previewPage(PREVIEW)
    if (page) return page
  }

  if (!IS_KNOWN_PATH) return <NotFound path={PATH} />

  // Ahead of the Supabase check: with no connection, "configure your database"
  // would be the wrong advice for the right symptom.
  if (!online && !ignoredOffline) {
    return <Offline onDismiss={() => setIgnoredOffline(true)} />
  }

  // Nothing in the app works without credentials, so say so plainly instead of
  // failing at the first fetch with a browser console error.
  if (!isSupabaseConfigured) return <SetupScreen />

  if (loading) return <BootScreen />

  if (!user) {
    const switchMode = (next) => {
      clearMessages()
      setMode(next)
    }

    return (
      <AuthLayout mode={mode} onSwitch={switchMode}>
        {mode === 'login' ? (
          <LoginForm
            onSubmit={signIn}
            pending={pending}
            error={error}
            onSwitch={switchMode}
            onDirty={clearMessages}
          />
        ) : (
          <SignupForm
            onSubmit={signUp}
            pending={pending}
            error={error}
            notice={notice}
            onSwitch={switchMode}
            onDirty={clearMessages}
          />
        )}
      </AuthLayout>
    )
  }

  return <Modules user={user} onSignOut={signOut} />
}

/** Error pages on demand, for design work and for checking them after a change. */
function previewPage(name) {
  switch (name) {
    case '404':
      return <NotFound path="/money/august/2026" />
    case 'offline':
      return <Offline onDismiss={() => window.location.assign('/')} />
    case 'crash': {
      const fake = new Error("Cannot read properties of null (reading 'grams')")
      fake.stack = `TypeError: ${fake.message}\n    at Tracker (Tracker.jsx:118:24)\n    at renderWithHooks (react-dom.js:16305:18)`
      return <CrashScreen error={fake} onRetry={() => window.location.assign('/')} />
    }
    default:
      return null
  }
}

/**
 * Food and Money, side by side behind a tab bar.
 *
 * Both modules stay mounted once visited and are hidden with `display: none`
 * rather than unmounted, so each keeps its own state — the day you were looking
 * at, the month you'd navigated to, the entries already fetched. Scroll offset
 * isn't part of React state, so it's captured on the way out and restored on
 * the way back in.
 */
function Modules({ user, onSignOut }) {
  const [tab, setTab] = useState('food')
  const [moneyVisited, setMoneyVisited] = useState(false)
  const scrollPositions = useRef({ food: 0, money: 0 })

  function switchTab(next) {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    if (next === 'money') setMoneyVisited(true)
    setTab(next)
  }

  // Layout effect, not a plain effect: restore before paint so the page never
  // flashes at the top before jumping back down.
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.current[tab] ?? 0)
  }, [tab])

  return (
    <>
      <div style={{ display: tab === 'food' ? undefined : 'none' }}>
        <Tracker user={user} onSignOut={onSignOut} />
      </div>

      {moneyVisited && (
        <div style={{ display: tab === 'money' ? undefined : 'none' }}>
          <Suspense fallback={<ModuleLoading />}>
            <ExpenseTracker user={user} onSignOut={onSignOut} />
          </Suspense>
        </div>
      )}

      <TabBar value={tab} onChange={switchTab} />
    </>
  )
}

function ModuleLoading() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Icon3D name="moneywings" size={64} float />
      <p className="font-display text-sm font-extrabold uppercase tracking-[0.28em] text-ink-400">
        Money
      </p>
    </div>
  )
}

/** Held only for the first session check — usually a single frame. */
function BootScreen() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-5"
      role="status"
      aria-live="polite"
    >
      <Icon3D name="salad" size={76} float />
      <p className="font-display text-sm font-extrabold uppercase tracking-[0.28em] text-ink-400">
        Zephr
      </p>
      <span className="sr-only">Checking your session…</span>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5">
      <div className="card w-full max-w-[440px] p-6">
        <Icon3D name="gear" size={64} className="mb-4" />
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          One step left: connect Supabase
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-ink-500">
          Zephr can’t reach a database yet. Copy <code className="font-bold">.env.example</code> to{' '}
          <code className="font-bold">.env</code>, paste in your project URL and anon key, then
          restart the dev server.
        </p>

        <pre className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-4 text-xs font-bold leading-relaxed text-ink-700">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
        </pre>

        <p className="mt-4 text-xs font-semibold text-ink-400">
          Both values live in Supabase → Project Settings → API. Full walkthrough in the README.
        </p>
      </div>
    </div>
  )
}
