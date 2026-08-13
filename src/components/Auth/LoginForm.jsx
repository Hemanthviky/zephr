import { useState } from 'react'
import { ArrowRight, AtSign, KeyRound, AlertTriangle, Check } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'

export default function LoginForm({
  onSubmit,
  pending,
  error,
  onSwitch,
  onDirty,
  rememberedByDefault = true,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(rememberedByDefault)
  const [touched, setTouched] = useState(false)

  const emailError = touched && !email.includes('@') ? 'That doesn’t look like an email.' : ''
  const passwordError = touched && password.length < 6 ? 'At least 6 characters.' : ''
  const canSubmit = email.includes('@') && password.length >= 6

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit || pending) return
    onSubmit(email, password, remember)
  }

  // Any keystroke clears the previous server error — stale red text under a
  // field the user is actively fixing is just noise.
  const change = (setter) => (event) => {
    setter(event.target.value)
    if (error) onDirty?.()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">Welcome back</h2>
      <p className="mb-5 mt-1 text-sm font-medium text-ink-400">
        Pick up wherever yesterday left off.
      </p>

      <div className="space-y-4">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          icon={AtSign}
          value={email}
          onChange={change(setEmail)}
          error={emailError}
        />

        <Input
          label="Password"
          type="password"
          revealable
          autoComplete="current-password"
          placeholder="••••••••"
          icon={KeyRound}
          value={password}
          onChange={change(setPassword)}
          error={passwordError}
        />
      </div>

      <RememberMe checked={remember} onChange={setRemember} />

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600 animate-pop-in"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        iconRight={ArrowRight}
        className="mt-6"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </Button>

      <p className="mt-4 text-center text-sm font-medium text-ink-400">
        New here?{' '}
        <button
          type="button"
          onClick={() => onSwitch('signup')}
          className="font-extrabold text-ink-900 underline decoration-lime-400 decoration-[3px] underline-offset-4"
        >
          Make an account
        </button>
      </p>
    </form>
  )
}

/**
 * Checkbox, built rather than styled — a native one can't carry the app's
 * chunky border and tactile press, and `appearance: none` plus a hand-drawn
 * tick is the usual result anyway. The real input stays in the DOM, visually
 * hidden, so it keeps its own focus ring, label association and keyboard
 * behaviour for free.
 */
function RememberMe({ checked, onChange }) {
  return (
    <label
      htmlFor="remember-me"
      className="mt-4 flex cursor-pointer select-none items-center gap-3"
    >
      <input
        id="remember-me"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-150',
          'peer-focus-visible:ring-4 peer-focus-visible:ring-lime-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream-50',
          checked
            ? 'border-ink-900 bg-lime-400 shadow-press-sm'
            : 'border-ink-900/20 bg-cream-100',
        ].join(' ')}
      >
        {checked && <Check className="h-4 w-4 text-ink-900" strokeWidth={4} />}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-ink-700">Keep me logged in</span>
        <span className="block text-xs font-medium text-ink-400">
          {checked
            ? 'You’ll stay signed in on this device.'
            : 'You’ll be signed out when you close the tab.'}
        </span>
      </span>
    </label>
  )
}
