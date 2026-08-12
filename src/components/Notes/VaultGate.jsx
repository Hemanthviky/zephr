import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { scorePassword } from '../../utils/vaultCrypto'

/**
 * The door to the locked half of the board.
 *
 * One component, two jobs, because they're the same conversation at different
 * points in time: "choose the passphrase" the first time, "prove you know it"
 * every time after. Which one you get is decided by whether a vault row exists,
 * never by a prop the caller has to remember to set.
 *
 * The setup half is blunt on purpose. Every other destructive thing in Zephr is
 * a two-tap confirm on a row you can re-enter; this one cannot be undone by
 * anybody, including me, because there is nothing on the server that could
 * decrypt those notes. So it asks for the passphrase twice, refuses anything
 * short, and makes you tick a box that says out loud what forgetting it costs.
 * A checkbox as a speed bump is usually cargo cult. Here it's the only warning
 * that arrives before the consequence instead of after it.
 */
export default function VaultGate({
  open,
  onClose,
  status,
  mode = 'auto',
  hint,
  supported,
  busy,
  error,
  onSetup,
  onUnlock,
  onChange,
  onDismissError,
}) {
  // 'change' is asked for explicitly; the other two follow from whether a vault
  // row exists, so no caller has to keep track of which screen is due.
  const screen = mode === 'change' ? 'change' : status === 'absent' ? 'setup' : 'unlock'
  const isSetup = screen === 'setup'
  const isChange = screen === 'change'
  // Both of these ask for a *new* passphrase twice and warn about losing it.
  const choosing = isSetup || isChange

  const [current, setCurrent] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ownHint, setOwnHint] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // Never leave a passphrase sitting in a closed component's state.
  useEffect(() => {
    if (open) {
      setOwnHint(isChange ? (hint ?? '') : '')
      return
    }
    setCurrent('')
    setPassphrase('')
    setConfirm('')
    setOwnHint('')
    setUnderstood(false)
    setRevealed(false)
  }, [open, isChange, hint])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  const strength = choosing ? scorePassword(passphrase) : null
  const longEnough = passphrase.length >= 10
  const matches = passphrase.length > 0 && passphrase === confirm

  const canSubmit = choosing
    ? longEnough && matches && understood && !busy && (!isChange || current.length > 0)
    : passphrase.length > 0 && !busy

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return

    const ok = isChange
      ? await onChange(current, passphrase, ownHint)
      : isSetup
        ? await onSetup(passphrase, ownHint)
        : await onUnlock(passphrase)

    if (ok) {
      setCurrent('')
      setPassphrase('')
      setConfirm('')
      onClose()
    }
  }

  function updatePassphrase(next) {
    if (error) onDismissError?.()
    setPassphrase(next)
  }

  return (
    <AnimatePresence>
      {/* z-[70], above the note sheet's z-[60]: turning the lock on mid-edit
          opens this over that, and the passphrase prompt has to be on top. */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={
              isChange
                ? 'Change your master passphrase'
                : isSetup
                  ? 'Create your vault'
                  : 'Unlock your vault'
            }
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="sheet max-w-[480px]"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-start gap-3 px-5 pb-2 pt-4">
              <Icon3D name={choosing ? 'key' : 'lockkey'} size={40} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight">
                  {isChange
                    ? 'Change your passphrase'
                    : isSetup
                      ? 'Set a master passphrase'
                      : 'Unlock the vault'}
                </h2>
                <p className="mt-0.5 text-xs font-bold leading-snug text-ink-400">
                  {isChange
                    ? 'Every saved login is re-encrypted under the new one.'
                    : isSetup
                      ? 'One passphrase locks every password you save here.'
                      : 'Your saved logins are encrypted until you type it.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe">
              {!supported && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                  <span>
                    This browser won’t do encryption on an insecure page. Open Zephr over https (or
                    on localhost) and the vault will work.
                  </span>
                </div>
              )}

              {/* Said before the field, not after the mistake. */}
              {isSetup && (
                <div className="mb-4 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-3.5">
                  <p className="flex items-center gap-1.5 font-display text-sm font-extrabold">
                    <ShieldCheck className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                    How this works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-relaxed text-ink-500">
                    <li>
                      Passwords are encrypted <strong className="text-ink-900">on this device</strong>{' '}
                      before they’re saved. The server only ever stores the scrambled version.
                    </li>
                    <li>
                      Your passphrase is never sent anywhere and never stored — not even hashed.
                    </li>
                    <li className="text-coral-600">
                      Which means <strong>nobody can reset it</strong>. Forget it and those passwords
                      are gone for good. Write it down somewhere real.
                    </li>
                  </ul>
                </div>
              )}

              {/* Changing it proves you know the old one first. Without this,
                  an unlocked laptop is enough to lock its owner out. */}
              {isChange && (
                <div className="mb-4">
                  <label htmlFor="vault-current" className="label-caps mb-2 block">
                    Current passphrase
                  </label>
                  <input
                    id="vault-current"
                    type={revealed ? 'text' : 'password'}
                    value={current}
                    onChange={(event) => {
                      if (error) onDismissError?.()
                      setCurrent(event.target.value)
                    }}
                    autoFocus
                    autoComplete="current-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-bold text-ink-900 shadow-inset transition-colors focus:border-lime-500"
                  />
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="vault-pass" className="label-caps mb-2 block">
                  {isChange ? 'New passphrase' : isSetup ? 'Master passphrase' : 'Passphrase'}
                </label>
                <div className="relative">
                  <input
                    id="vault-pass"
                    type={revealed ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(event) => updatePassphrase(event.target.value)}
                    autoFocus={!isChange}
                    autoComplete={choosing ? 'new-password' : 'current-password'}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={choosing ? 'Four unrelated words work well' : 'Your passphrase'}
                    className="min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 pr-12 text-base font-bold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealed((on) => !on)}
                    aria-label={revealed ? 'Hide passphrase' : 'Show passphrase'}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
                  >
                    {revealed ? (
                      <EyeOff className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} />
                    ) : (
                      <Eye className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} />
                    )}
                  </button>
                </div>

                {choosing && passphrase && (
                  <p
                    className="mt-2 text-xs font-bold"
                    style={{ color: strength.level > 1 ? '#6E6659' : '#E33E1C' }}
                  >
                    {longEnough
                      ? `${strength.label} · ${strength.bits} bits — ${strength.hint}`
                      : 'At least 10 characters. This one guards everything else.'}
                  </p>
                )}

                {/* Only on the unlock side, and only if they left one. */}
                {!choosing && hint && (
                  <p className="mt-2 rounded-xl border-2 border-ink-900/10 bg-cream-200 px-3 py-2 text-xs font-semibold text-ink-500">
                    <span className="label-caps mr-1.5">Hint</span>
                    {hint}
                  </p>
                )}
              </div>

              {choosing && (
                <>
                  <div className="mb-4">
                    <label htmlFor="vault-confirm" className="label-caps mb-2 block">
                      Type it again
                    </label>
                    <input
                      id="vault-confirm"
                      type={revealed ? 'text' : 'password'}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className={[
                        'min-h-[56px] w-full rounded-2xl border-[2.5px] bg-cream-50 px-4 text-base font-bold text-ink-900 shadow-inset transition-colors focus:border-lime-500',
                        confirm && !matches ? 'border-coral-500' : 'border-ink-900/15',
                      ].join(' ')}
                    />
                    {confirm && !matches && (
                      <p className="mt-2 text-xs font-bold text-coral-600">
                        These two don’t match yet.
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="vault-hint" className="label-caps mb-2 block">
                      Hint{' '}
                      <span className="normal-case tracking-normal text-ink-300">· optional</span>
                    </label>
                    <input
                      id="vault-hint"
                      type="text"
                      value={ownHint}
                      onChange={(event) => setOwnHint(event.target.value)}
                      maxLength={120}
                      placeholder="e.g. the road we grew up on"
                      className="min-h-[52px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                    />
                    <p className="mt-1.5 text-[0.7rem] font-semibold text-ink-400">
                      Stored unencrypted, so it must not be the passphrase itself.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setUnderstood((on) => !on)}
                    aria-pressed={understood}
                    className={[
                      'mb-4 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors',
                      understood
                        ? 'border-ink-900 bg-lime-100'
                        : 'border-ink-900/15 bg-cream-50 hover:border-ink-900/40',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-ink-900 transition-colors',
                        understood ? 'bg-lime-400' : 'bg-cream-50',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {understood && <ShieldCheck className="h-3.5 w-3.5" strokeWidth={3.5} />}
                    </span>
                    <span className="text-xs font-bold leading-relaxed">
                      {isChange
                        ? 'I understand that if I forget the new passphrase, the passwords in here cannot be recovered by anyone.'
                        : 'I understand that if I forget this passphrase, the passwords I save here cannot be recovered by anyone.'}
                    </span>
                  </button>
                </>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-2.5 text-sm font-semibold text-coral-600"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                icon={choosing ? ShieldCheck : KeyRound}
                loading={busy}
                disabled={!canSubmit || !supported}
                className="mb-2"
              >
                {busy
                  ? isChange
                    ? 'Re-encrypting…'
                    : isSetup
                      ? 'Building your vault…'
                      : 'Checking…'
                  : isChange
                    ? 'Change it'
                    : isSetup
                      ? 'Create the vault'
                      : 'Unlock'}
              </Button>

              {/* PBKDF2 at 310k iterations takes a beat on a phone. Saying so
                  turns "it's frozen" into "it's working". */}
              {busy && (
                <p className="pb-2 text-center text-[0.7rem] font-semibold text-ink-400">
                  {isChange
                    ? 'Rewriting every saved login. Don’t close this.'
                    : 'Stretching your passphrase — this is meant to be slow.'}
                </p>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
