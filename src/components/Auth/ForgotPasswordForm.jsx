import { useState } from 'react'
import { ArrowLeft, ArrowRight, AtSign, MailCheck } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'
import Icon3D from '../shared/Icon3D'
import { FormError } from './authShared'

/**
 * "I can't get in" — step one of two.
 *
 * The confirmation says *if* that address has an account, and it says it
 * whether or not one does. Supabase deliberately returns success for an
 * unknown email so this form can't be used to enumerate who has an account,
 * and the copy has to hold that line too: "we couldn't find that email" would
 * hand back exactly what the API refused to confirm.
 *
 * So the address is echoed rather than validated against anything, which also
 * makes the typo case self-correcting — seeing "hemanth@gmial.com" in the
 * confirmation is the fastest way to notice.
 */
export default function ForgotPasswordForm({ onSubmit, pending, error, notice, onSwitch, onDirty }) {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)

  const emailError = touched && !email.includes('@') ? 'That doesn’t look like an email.' : ''
  const canSubmit = email.includes('@')

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit || pending) return
    onSubmit(email)
  }

  const change = (event) => {
    setEmail(event.target.value)
    if (error) onDirty?.()
  }

  // Sent. Replace the form rather than leaving a filled-in one under a banner —
  // the next step is in their inbox, not on this screen.
  if (notice) {
    return (
      <div className="py-4 text-center animate-pop-in">
        <Icon3D name="key" size={72} className="mb-4" />
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
      <h2 className="font-display text-2xl font-extrabold tracking-tight">Forgot your password?</h2>
      <p className="mb-5 mt-1 text-sm font-medium text-ink-400">
        Tell us the address you signed up with and we’ll send a link to set a new one.
      </p>

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
        onChange={change}
        error={emailError}
      />

      <FormError>{error}</FormError>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        iconRight={ArrowRight}
        className="mt-6"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="mt-4 text-center text-sm font-medium text-ink-400">
        <button
          type="button"
          onClick={() => onSwitch('login')}
          className="inline-flex items-center gap-1.5 font-extrabold text-ink-900 underline decoration-lime-400 decoration-[3px] underline-offset-4"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={3} />
          Back to log in
        </button>
      </p>
    </form>
  )
}
