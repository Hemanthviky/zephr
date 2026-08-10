import { useState } from 'react'
import { ArrowRight, AtSign, KeyRound, AlertTriangle } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'

export default function LoginForm({ onSubmit, pending, error, onSwitch, onDirty }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const emailError = touched && !email.includes('@') ? 'That doesn’t look like an email.' : ''
  const passwordError = touched && password.length < 6 ? 'At least 6 characters.' : ''
  const canSubmit = email.includes('@') && password.length >= 6

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit || pending) return
    onSubmit(email, password)
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
        Pick up where yesterday’s plate left off.
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
          autoComplete="current-password"
          placeholder="••••••••"
          icon={KeyRound}
          value={password}
          onChange={change(setPassword)}
          error={passwordError}
        />
      </div>

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
