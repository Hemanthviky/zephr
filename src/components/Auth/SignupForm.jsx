import { useState } from 'react'
import { ArrowRight, AtSign, KeyRound, MailCheck, Smile } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'
import Icon3D from '../shared/Icon3D'
import { FormError, PasswordStrength } from './authShared'

export default function SignupForm({ onSubmit, pending, error, notice, onSwitch, onDirty }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const nameError = touched && !name.trim() ? 'We need something to call you.' : ''
  const emailError = touched && !email.includes('@') ? 'That doesn’t look like an email.' : ''
  const passwordError =
    touched && password.length < 6 ? 'Supabase needs at least 6 characters.' : ''
  const canSubmit = name.trim().length > 0 && email.includes('@') && password.length >= 6

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit || pending) return
    onSubmit(email, password, name)
  }

  const change = (setter) => (event) => {
    setter(event.target.value)
    if (error) onDirty?.()
  }

  // Signup succeeded but the project requires email confirmation — replace the
  // form entirely rather than leaving a filled-in form sitting under a banner.
  if (notice) {
    return (
      <div className="py-4 text-center animate-pop-in">
        <Icon3D name="party" size={72} className="mb-4" />
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Check your inbox</h2>
        <p className="mx-auto mt-2 max-w-[17rem] text-sm font-medium leading-relaxed text-ink-500">
          {notice}
        </p>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          icon={MailCheck}
          className="mt-6"
          onClick={() => onSwitch('login')}
        >
          Back to log in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">Start tracking</h2>
      <p className="mb-5 mt-1 text-sm font-medium text-ink-400">
        One login for all four trackers, on every device you use.
      </p>

      <div className="space-y-4">
        <Input
          label="What should we call you?"
          type="text"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={60}
          placeholder="Hemanth"
          icon={Smile}
          value={name}
          onChange={change(setName)}
          error={nameError}
          hint={!nameError ? 'Just a first name is fine — you’ll see it around the app.' : undefined}
        />

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

        <div>
          <Input
            label="Password"
            type="password"
            revealable
            autoComplete="new-password"
            placeholder="At least 6 characters"
            icon={KeyRound}
            value={password}
            onChange={change(setPassword)}
            error={passwordError}
          />

          <PasswordStrength password={password} hidden={Boolean(passwordError)} />
        </div>
      </div>

      <FormError>{error}</FormError>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        iconRight={ArrowRight}
        className="mt-6"
      >
        {pending ? 'Creating…' : 'Create account'}
      </Button>

      <p className="mt-4 text-center text-sm font-medium text-ink-400">
        Already tracking?{' '}
        <button
          type="button"
          onClick={() => onSwitch('login')}
          className="font-extrabold text-ink-900 underline decoration-lime-400 decoration-[3px] underline-offset-4"
        >
          Log in
        </button>
      </p>
    </form>
  )
}
