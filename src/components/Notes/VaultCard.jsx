import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Pin,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { copyToClipboard, hostOf, hrefOf, shortAgo } from '../../utils/noteHelpers'
import { scorePassword } from '../../utils/vaultCrypto'

/**
 * A saved login, on the same board as the paper.
 *
 * It had to look like a different *material* to the notes around it, and the
 * house rules rule out the obvious move — Zephr has no dark surfaces, so a
 * black "secure" card was never available. What it uses instead is the thing
 * actual secure documents use: the crosshatched guilloche you find printed
 * inside a bank envelope, here as the fill of the redaction bar over the
 * password, plus a foil strip down the left edge and a hard ink border where
 * the notes have soft coloured ones. It also doesn't lean and has no tape.
 * Across the board it reads as "that one's a card, not paper" before you've
 * read a word of it.
 *
 * Three states, and the middle one is the point:
 *
 *   vault locked   — title and website only, because that's genuinely all the
 *                    browser has. There is no key in memory, so there is
 *                    nothing to show and no way to fake it.
 *   vault open     — fields decrypt on demand, and the password is still
 *                    redacted until asked for, then re-hides itself.
 *   won't decrypt  — said plainly rather than rendered as an empty field.
 *
 * The auto-hide is 20 seconds, drawn as a bar that drains, because a password
 * left revealed on a phone that someone puts down is the failure this whole
 * feature exists to avoid — and a countdown you can watch is the difference
 * between it feeling protective and feeling broken.
 */

const REVEAL_MS = 20_000

export default function VaultCard({
  note,
  unlocked,
  onOpen,
  onTogglePin,
  onDelete,
  onReveal,
  onRequestUnlock,
}) {
  const [payload, setPayload] = useState(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const hideTimer = useRef(null)
  const isPending = String(note.id).startsWith('optimistic-')

  const forget = useCallback(() => {
    clearTimeout(hideTimer.current)
    setRevealed(false)
    setPayload(null)
    setFailed(false)
  }, [])

  /**
   * Follow the vault.
   *
   * Opening it decrypts this card's fields straight away — a manager that makes
   * you tap every card to find out which account it's for is a worse filing
   * cabinet than a piece of paper. Only the *password* stays redacted after
   * that, which is the field that actually needs it.
   *
   * Locking it throws all of that away. That direction is the important one:
   * the idle timer would otherwise expire with a decrypted payload still in
   * this component's state and still on the screen.
   */
  useEffect(() => {
    if (!unlocked) {
      forget()
      return
    }

    let cancelled = false
    setBusy(true)
    onReveal(note).then((result) => {
      if (cancelled) return
      setBusy(false)
      if (result) setPayload(result)
      else setFailed(true)
    })

    return () => {
      cancelled = true
    }
    // note.secret rather than note: a pin or a colour change must not re-run
    // the decryption, but a re-encrypted blob must.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, note.secret, forget])

  // Leaving the board (a tab switch unmounts nothing here, but a delete or a
  // filter does) must not leave a timer holding a decrypted payload alive.
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  /** The payload, decrypting it first if the effect above hasn't landed yet. */
  async function load() {
    if (payload) return payload
    setBusy(true)
    const result = await onReveal(note)
    setBusy(false)
    if (!result) {
      setFailed(true)
      return null
    }
    setPayload(result)
    return result
  }

  async function toggleReveal() {
    if (revealed) {
      clearTimeout(hideTimer.current)
      setRevealed(false)
      return
    }

    if (!unlocked) {
      onRequestUnlock()
      return
    }

    const result = await load()
    if (!result) return

    setRevealed(true)
    hideTimer.current = setTimeout(() => setRevealed(false), REVEAL_MS)
  }

  async function copyField(field) {
    if (!unlocked) {
      onRequestUnlock()
      return
    }
    const result = await load()
    if (!result) return
    if (await copyToClipboard(result[field] ?? '')) setCopied(field)
  }

  async function handleDelete() {
    setDeleting(true)
    const ok = await onDelete(note.id)
    if (!ok) {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const host = hostOf(payload?.url ?? '')
  const href = hrefOf(payload?.url ?? '')
  const strength = payload?.password ? scorePassword(payload.password) : null

  return (
    <motion.li
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="mb-4 break-inside-avoid"
      style={{ breakInside: 'avoid' }}
    >
      <motion.article
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative overflow-hidden rounded-[1.4rem] border-2 border-ink-900 bg-cream-50 shadow-card transition-shadow hover:shadow-lift"
      >
        {/* The foil edge. Two of these side by side on the board are what make
            the vault read as a set rather than as six unrelated cards. */}
        <span className="foil absolute inset-y-0 left-0 w-[7px]" aria-hidden="true" />

        {note.pinned && (
          <span
            className="pointer-events-none absolute -top-3 right-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-900 bg-lime-400 shadow-press-sm"
            aria-hidden="true"
          >
            <Pin className="h-3.5 w-3.5" strokeWidth={3} fill="currentColor" />
          </span>
        )}

        <div className="pl-[7px]">
          <button
            type="button"
            onClick={() => (unlocked ? onOpen(note) : onRequestUnlock())}
            disabled={isPending}
            aria-label={`Edit ${note.title || 'this login'}`}
            className="flex w-full items-center gap-2.5 px-3.5 pb-2 pt-3.5 text-left disabled:opacity-60"
          >
            <span
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900',
                unlocked ? 'bg-lime-400' : 'bg-cream-200',
              ].join(' ')}
              aria-hidden="true"
            >
              {unlocked ? (
                <Unlock className="h-4 w-4" strokeWidth={3} />
              ) : (
                <Lock className="h-4 w-4 text-ink-500" strokeWidth={3} />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[0.98rem] font-extrabold leading-snug tracking-tight">
                {note.title?.trim() || 'Untitled login'}
              </span>
              <span className="block truncate text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-ink-400">
                {unlocked ? (host || 'Saved login') : 'Locked'}
              </span>
            </span>
          </button>

          <div className="space-y-1.5 px-3.5 pb-2">
            {failed ? (
              <p className="rounded-xl border-2 border-coral-500 bg-coral-100 px-3 py-2 text-[0.72rem] font-bold leading-snug text-coral-600">
                This one won’t open with the current passphrase.
              </p>
            ) : (
              <>
                {/* Username. Shown in full once the vault is open — it isn't the
                    secret, and hiding it would mean two reveals to read one
                    login. */}
                <Field
                  label="User"
                  value={payload?.username || ''}
                  masked={!unlocked}
                  placeholder={busy ? '…' : '—'}
                  copied={copied === 'username'}
                  onCopy={() => copyField('username')}
                />

                <div>
                  <div className="flex items-stretch gap-1.5">
                    <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border-2 border-ink-900/12">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-300">
                        Pass
                      </span>

                      {revealed && payload ? (
                        <p className="nums min-h-[38px] break-all bg-cream-100 py-2 pl-[3.1rem] pr-2 text-[0.8rem] font-extrabold leading-tight">
                          {payload.password || '—'}
                        </p>
                      ) : (
                        // The redaction bar. Not dots — a guilloche crosshatch,
                        // which is what "there is something here and it is not
                        // for you" looks like on paper.
                        <span
                          className="guilloche block min-h-[38px]"
                          aria-label="Password hidden"
                          role="img"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={toggleReveal}
                      disabled={isPending}
                      aria-label={revealed ? 'Hide password' : 'Reveal password'}
                      aria-pressed={revealed}
                      className="tactile flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm disabled:opacity-40"
                    >
                      {revealed ? (
                        <EyeOff className="h-4 w-4" strokeWidth={2.75} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={2.75} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyField('password')}
                      disabled={isPending}
                      aria-label="Copy password"
                      className="tactile flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm disabled:opacity-40"
                    >
                      {copied === 'password' ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        <Copy className="h-4 w-4" strokeWidth={2.75} />
                      )}
                    </button>
                  </div>

                  {/* The drain. Twenty seconds is long enough to type a
                      password into a phone and short enough to matter. */}
                  <AnimatePresence>
                    {revealed && (
                      <motion.span
                        key="drain"
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: REVEAL_MS / 1000, ease: 'linear' }}
                        className="mt-1 block h-1 origin-left rounded-pill bg-lime-500"
                        aria-hidden="true"
                      />
                    )}
                  </AnimatePresence>

                  {revealed && strength && (
                    <p className="nums mt-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-ink-400">
                      {strength.label} · {strength.bits} bits
                    </p>
                  )}
                </div>

                {/* The website isn't the secret — once the vault is open it's
                    a link, and needing to reveal the password to click through
                    to the site would be backwards. The free-text note *is*
                    sensitive (it's where recovery codes go), so that one waits. */}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-[0.7rem] font-extrabold text-ink-500 underline decoration-ink-900/20 underline-offset-2 hover:text-ink-900"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />
                    <span className="truncate">{host}</span>
                  </a>
                )}

                {revealed && payload?.note && (
                  <p className="whitespace-pre-wrap break-words rounded-xl border-2 border-ink-900/10 bg-cream-100 p-2 text-[0.72rem] font-semibold leading-relaxed text-ink-700">
                    {payload.note}
                  </p>
                )}
              </>
            )}

            {!unlocked && (
              <button
                type="button"
                onClick={onRequestUnlock}
                className="tactile flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-ink-900 bg-lime-400 text-[0.75rem] font-extrabold shadow-press-sm hover:bg-lime-300"
              >
                <Unlock className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                Unlock the vault
              </button>
            )}
          </div>

          {note.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3.5 pb-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-pill border border-ink-900/15 bg-ink-900/[0.04] px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-ink-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <footer className="flex items-center gap-1 px-2 pb-2 pt-1">
            <span className="nums flex-1 truncate pl-2 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-ink-400">
              {shortAgo(note.updated_at)}
            </span>

            <button
              type="button"
              onClick={() => onTogglePin(note)}
              disabled={isPending}
              aria-pressed={note.pinned}
              aria-label={note.pinned ? 'Unpin this login' : 'Pin this login'}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-30',
                note.pinned ? 'text-ink-900' : 'text-ink-300 hover:bg-ink-900/[0.06] hover:text-ink-700',
              ].join(' ')}
            >
              <Pin
                className="h-4 w-4"
                strokeWidth={2.75}
                fill={note.pinned ? 'currentColor' : 'none'}
              />
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isPending}
              aria-label="Delete this login"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.75} />
            </button>
          </footer>
        </div>

        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[1.3rem] bg-coral-100/95 p-4 backdrop-blur-[1px]"
          >
            <p className="text-center font-display text-sm font-extrabold leading-tight text-coral-600">
              Delete this login?
              <span className="mt-1 block text-[0.7rem] font-bold">
                Nobody can bring it back.
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                aria-label="Keep it"
                className="tactile flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Confirm delete"
                className="tactile flex h-11 min-w-[68px] items-center justify-center gap-1 rounded-xl border-2 border-ink-900 bg-coral-500 px-3 font-display text-sm font-extrabold text-cream-50 shadow-press-coral"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                Yes
              </button>
            </div>
          </motion.div>
        )}
      </motion.article>
    </motion.li>
  )
}

/** One labelled, copyable line. Currently the username; kept generic so the
 *  next field the vault grows doesn't arrive as a fourth copy of this markup. */
function Field({ label, value, masked, placeholder, copied, onCopy }) {
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border-2 border-ink-900/12">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-300">
          {label}
        </span>
        {masked ? (
          <span className="guilloche block min-h-[38px]" role="img" aria-label={`${label} hidden`} />
        ) : (
          <span className="block min-h-[38px] truncate bg-cream-100 py-2 pl-[3.1rem] pr-2 text-[0.8rem] font-bold leading-tight">
            {value || placeholder}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="tactile flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
      >
        {copied ? (
          <Check className="h-4 w-4 text-avocado-600" strokeWidth={3} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={2.75} />
        )}
      </button>
    </div>
  )
}
