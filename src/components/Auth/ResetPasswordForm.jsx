import { useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'
import { FormError, PasswordStrength } from './authShared'

/**
 * "I can't get in" — step two, reached only by clicking the link in the mail.
 *
 * By the time this renders, the recovery link has already signed the user in;
 * `updateUser` needs a session to authenticate the change against. That's why
 * it asks for the new password twice and never for the old one — the mail *was*
 * the proof of identity, and someone who's forgotten their password by
 * definition can't confirm it.
 *
 * It also means backing out has to sign out rather than just navigating away,
 * which is `cancelRecovery`'s job over in useAuth.
 */
export default function ResetPasswordForm({ onSubmit, onCancel, pending, error }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const passwordError = touched && password.length < 6 ? 'At least 6 characters.' : ''
  // Held back until the second field has something in it — flagging a mismatch
  // against an empty box is just telling someone off for not having finished.
  const confirmError = touched && confirm && confirm !== password ? 'These don’t match.' : ''
  const canSubmit = password.length >= 6 && confirm === password

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit || pending) return
    onSubmit(password)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">Set a new password</h2>
      <p className="mb-5 mt-1 text-sm font-medium text-ink-400">
        Pick something you’ll remember. You’ll be logged in straight after.
      </p>

      <div className="space-y-4">
        <div>
          <Input
            label="New password"
            type="password"
            revealable
            autoComplete="new-password"
            placeholder="At least 6 characters"
            icon={KeyRound}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
          />
          <PasswordStrength password={password} hidden={Boolean(passwordError)} />
        </div>

        <Input
          label="Confirm new password"
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="Once more"
          icon={KeyRound}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
        />
      </div>

      <FormError>{error}</FormError>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        iconRight={Check}
        className="mt-6"
      >
        {pending ? 'Saving…' : 'Save new password'}
      </Button>

      <p className="mt-4 text-center text-sm font-medium text-ink-400">
        <button
          type="button"
          onClick={onCancel}
          className="font-extrabold text-ink-900 underline decoration-lime-400 decoration-[3px] underline-offset-4"
        >
          Cancel and log in instead
        </button>
      </p>
    </form>
  )
}
