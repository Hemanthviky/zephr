import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AuthLayout from './components/Auth/AuthLayout'
import LoginForm from './components/Auth/LoginForm'
import SignupForm from './components/Auth/SignupForm'
import Tracker from './components/Tracker/Tracker'
import TabBar from './components/shared/TabBar'
import ProfilePanel from './components/Settings/ProfilePanel'
import Icon3D from './components/shared/Icon3D'
import { LogoMark, Wordmark } from './components/shared/Logo'
import { AvatarPrefProvider, avatarIdOf } from './components/shared/Avatar'
import NotFound from './components/Errors/NotFound'
import Offline from './components/Errors/Offline'
import CrashScreen from './components/Errors/CrashScreen'
import { useAuth, displayName } from './hooks/useAuth'
import { useGoals } from './hooks/useGoals'
import { useOnline } from './hooks/useOnline'
import { isSupabaseConfigured } from './lib/supabaseClient'

// The Money tab pulls in recharts, which is heavier than everything else in the
// app combined. Split it out so opening Zephr to log a banana never downloads
// a charting library. Hospital is split for the same reason at a smaller scale:
// most sessions never open it, and nothing else in the app imports its chart.
// Notes joins them: it carries the vault's crypto and its own board, and a
// session spent logging food should never pay for either.
const ExpenseTracker = lazy(() => import('./components/Expenses/ExpenseTracker'))
const Hospital = lazy(() => import('./components/Hospital/Hospital'))
const Notes = lazy(() => import('./components/Notes/Notes'))

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

/**
 * Which tab you're on lives in the URL fragment (`#money`), so a refresh puts
 * you back where you were instead of dropping you on Food mid-task.
 *
 * The fragment rather than storage: it survives a reload, it's shareable, and
 * it can't disagree with what the address bar says. It's still not a route —
 * the pathname is what decides 404 — so nothing above needs to know about it.
 */
const TAB_IDS = new Set(['food', 'money', 'hospital', 'notes'])

function tabFromHash() {
  if (typeof window === 'undefined') return 'food'
  // Anything unrecognised falls back to Food. That deliberately includes the
  // `#access_token=…` fragment Supabase lands on after an email confirmation.
  const id = window.location.hash.slice(1)
  return TAB_IDS.has(id) ? id : 'food'
}

export default function App() {
  const {
    user,
    loading,
    pending,
    error,
    notice,
    rememberedByDefault,
    profileSaving,
    signIn,
    signUp,
    signOut,
    updateName,
    updateAvatar,
    clearMessages,
  } = useAuth()
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
            rememberedByDefault={rememberedByDefault}
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

  return (
    <Modules
      user={user}
      onSignOut={signOut}
      onUpdateName={updateName}
      onUpdateAvatar={updateAvatar}
      profileSaving={profileSaving}
      profileError={error}
      onClearError={clearMessages}
    />
  )
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
 * Calories, Money, Intake and Notes, side by side behind a tab bar.
 *
 * Modules stay mounted once visited and are hidden with `display: none`
 * rather than unmounted, so each keeps its own state — the day you were looking
 * at, the month you'd navigated to, the entries already fetched. Scroll offset
 * isn't part of React state, so it's captured on the way out and restored on
 * the way back in.
 *
 * That covers switching. A reload is the other half: the active tab is mirrored
 * into the URL fragment, so refreshing in the middle of the month's expenses
 * leaves you in the month's expenses.
 */
function Modules({
  user,
  onSignOut,
  onUpdateName,
  onUpdateAvatar,
  profileSaving,
  profileError,
  onClearError,
}) {
  const [tab, setTab] = useState(tabFromHash)
  // Reloading straight onto a lazy module has to mount it, or it would sit
  // behind a "visited" flag that only a tab switch can ever set.
  const [visited, setVisited] = useState(() => new Set([tab]))
  const [profileOpen, setProfileOpen] = useState(false)
  const scrollPositions = useRef({ food: 0, money: 0, hospital: 0, notes: 0 })

  // One goals instance for the whole app: the tracker reads the targets, the
  // profile edits the body stats behind them. Two hooks would drift apart the
  // moment either saved.
  const goalsState = useGoals(user.id)

  function switchTab(next) {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    markVisited(next)
    setTab(next)
  }

  function markVisited(id) {
    setVisited((seen) => (seen.has(id) ? seen : new Set(seen).add(id)))
  }

  // replaceState, not a hash assignment: writing location.hash pushes a history
  // entry, and after a few taps the back button would walk you through every
  // switch you made instead of leaving the app.
  useEffect(() => {
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}#${tab}`)
  }, [tab])

  // Someone editing the fragment by hand — or a browser restoring it — should
  // still land on the right tab.
  useEffect(() => {
    const onHashChange = () => {
      const next = tabFromHash()
      setTab((current) => {
        if (next === current) return current
        scrollPositions.current[current] = window.scrollY
        return next
      })
      markVisited(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Layout effect, not a plain effect: restore before paint so the page never
  // flashes at the top before jumping back down. `behavior: 'instant'` because
  // the page sets scroll-behavior: smooth globally, which would otherwise
  // animate the restore — turning "you're back where you were" into a visible
  // scroll the user didn't ask for.
  useLayoutEffect(() => {
    window.scrollTo({ top: scrollPositions.current[tab] ?? 0, behavior: 'instant' })
  }, [tab])

  function openProfile() {
    onClearError?.()
    setProfileOpen(true)
  }

  // Every avatar in the app — four module headers, the tab bar, the profile
  // card — resolves the same choice from here, so none of those components has
  // to carry a preference it otherwise has no interest in.
  return (
    <AvatarPrefProvider avatarId={avatarIdOf(user)} sex={goalsState.goals?.sex}>
      <div style={{ display: tab === 'food' ? undefined : 'none' }}>
        {/* Signing out lives in the profile now, so the modules no longer need it. */}
        <Tracker user={user} onOpenProfile={openProfile} goalsState={goalsState} />
      </div>

      {visited.has('money') && (
        <div style={{ display: tab === 'money' ? undefined : 'none' }}>
          <Suspense fallback={<ModuleLoading icon="moneywings" label="Money" />}>
            <ExpenseTracker user={user} onOpenProfile={openProfile} />
          </Suspense>
        </div>
      )}

      {visited.has('hospital') && (
        <div style={{ display: tab === 'hospital' ? undefined : 'none' }}>
          <Suspense fallback={<ModuleLoading icon="hospital" label="Intake" />}>
            <Hospital user={user} onOpenProfile={openProfile} />
          </Suspense>
        </div>
      )}

      {/* Staying mounted matters more here than anywhere else in the app: the
          vault's master key lives in memory inside this subtree, so unmounting
          Notes on a tab switch would re-prompt for the passphrase every time
          you glanced at the food log. */}
      {visited.has('notes') && (
        <div style={{ display: tab === 'notes' ? undefined : 'none' }}>
          <Suspense fallback={<ModuleLoading icon="pushpin" label="Notes" />}>
            <Notes user={user} onOpenProfile={openProfile} />
          </Suspense>
        </div>
      )}

      <TabBar
        value={tab}
        onChange={switchTab}
        userName={displayName(user)}
        userEmail={user.email}
        onOpenProfile={openProfile}
      />

      {/* Profile belongs to the app, not to either module, so it lives here
          alongside the tab bar that opens it. */}
      <ProfilePanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        onUpdateName={onUpdateName}
        onUpdateAvatar={onUpdateAvatar}
        saving={profileSaving}
        error={profileError}
        onClearError={onClearError}
        onSignOut={onSignOut}
        goals={goalsState.goals}
        onSaveGoals={goalsState.saveGoals}
        goalsSaving={goalsState.saving}
        goalsError={goalsState.error}
      />
    </AvatarPrefProvider>
  )
}

function ModuleLoading({ icon, label }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Icon3D name={icon} size={64} float />
      <p className="font-display text-sm font-extrabold uppercase tracking-[0.28em] text-ink-400">
        {label}
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
      <LogoMark size={76} float />
      <Wordmark height={20} />
      <span className="sr-only">Checking your session…</span>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-page py-10">
      <div className="card w-full max-w-[440px] p-5 sm:p-6">
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
