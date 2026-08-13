import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Dices, Eye, EyeOff, RefreshCw, Type } from 'lucide-react'
import {
  PASSWORD_DEFAULTS,
  generatePassphrase,
  generatePassword,
  scorePassword,
} from '../../utils/vaultCrypto'
import { copyToClipboard } from '../../utils/noteHelpers'

/**
 * The password input, its strength, and the generator that means you never
 * have to think one up.
 *
 * Three decisions worth defending:
 *
 *  • It starts hidden, but the reveal is one tap and it stays revealed while
 *    you edit. A field you can't see is a field you fat-finger, and the threat
 *    model for a phone in your own hand is not "someone is reading the screen"
 *    — it's a screenshot or a screen share, which the default covers.
 *  • The generator is *in* the field, not behind a menu. If generating is
 *    harder than typing 'hemanth123', people type 'hemanth123'.
 *  • The meter prices a password in bits and says what that buys. "Weak /
 *    Medium / Strong" on its own teaches nobody anything, and a green bar for
 *    'Password1!' is worse than no bar at all.
 */

const LEVELS = [
  { fill: '#FF5A38', track: 1 },
  { fill: '#FFA51F', track: 2 },
  { fill: '#AEDC0B', track: 3 },
  { fill: '#12B39A', track: 4 },
]

const CLASSES = [
  { id: 'upper', label: 'A–Z' },
  { id: 'lower', label: 'a–z' },
  { id: 'digits', label: '0–9' },
  { id: 'symbols', label: '!@#' },
]

export default function PasswordField({ value, onChange, autoFocus = false }) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tuning, setTuning] = useState(false)
  const [options, setOptions] = useState(PASSWORD_DEFAULTS)

  const strength = scorePassword(value)
  const level = LEVELS[strength.level]

  // The "Copied" tick is a state change with no other trigger to undo it.
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  function roll(next = options) {
    onChange(generatePassword(next))
    // Generating and then not being able to read what you got is absurd. This
    // is also the one place revealing is unambiguously safe: nobody has typed
    // a password they care about yet.
    setRevealed(true)
  }

  function rollWords() {
    onChange(generatePassphrase())
    setRevealed(true)
  }

  function toggleClass(name) {
    const next = { ...options, [name]: !options[name] }
    // Turning the last class off would generate from an empty alphabet, so the
    // toggle simply refuses — quieter than an error under a checkbox.
    if (!CLASSES.some((entry) => next[entry.id])) return
    setOptions(next)
    if (value) roll(next)
  }

  async function handleCopy() {
    if (!value) return
    setCopied(await copyToClipboard(value))
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label-caps">
          Password
        </label>
        {value && (
          <span
            className="nums text-[0.7rem] font-extrabold"
            style={{
              color: strength.level > 1 ? 'rgb(var(--c-ink-700))' : 'rgb(var(--c-coral-600))',
            }}
          >
            {strength.label} · {strength.bits} bits
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-1.5">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            // `type` flipping between password and text is what a manager does;
            // the alternative (a text input with a CSS mask) breaks the
            // browser's own "never autofill this" heuristics.
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoFocus={autoFocus}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Type it, or roll one →"
            className="nums min-h-[56px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 pr-12 text-base font-bold tracking-[0.02em] text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-300 focus:border-lime-500"
          />
          <button
            type="button"
            onClick={() => setRevealed((on) => !on)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-cream-200 hover:text-ink-900"
          >
            {revealed ? (
              <EyeOff className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} />
            ) : (
              <Eye className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          aria-label="Copy password"
          title="Copy password"
          className="tactile flex h-[56px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-press-sm disabled:opacity-40 disabled:shadow-none"
        >
          {copied ? (
            <Check className="h-[1.15rem] w-[1.15rem] text-avocado-600" strokeWidth={3} />
          ) : (
            <Copy className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.75} />
          )}
        </button>

        <button
          type="button"
          onClick={() => roll()}
          aria-label="Generate a password"
          title="Generate a password"
          className="tactile flex h-[56px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm hover:bg-lime-300"
        >
          <Dices className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.75} />
        </button>
      </div>

      {/* Four segments rather than one continuous bar: a bar that's 62% full
          invites "how do I get to 100%", which isn't a question this has an
          answer to. Four blocks read as a band, which is what it is. */}
      {value && (
        <>
          <div className="mt-2.5 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((slot) => (
              <span
                key={slot}
                className="h-1.5 flex-1 rounded-pill transition-colors"
                style={{
                  background: slot < level.track ? level.fill : 'rgb(var(--c-ink-900) / 0.12)',
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[0.7rem] font-semibold leading-snug text-ink-400">
            {strength.hint}
          </p>
        </>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={rollWords}
          className="tactile inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-ink-900/15 bg-cream-50 px-3 text-xs font-extrabold hover:border-ink-900/40"
        >
          <Type className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          Words
        </button>
        <button
          type="button"
          onClick={() => setTuning((open) => !open)}
          aria-expanded={tuning}
          className="tactile inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border-2 border-ink-900/15 bg-cream-50 px-3 text-xs font-extrabold hover:border-ink-900/40"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          {options.length} chars
        </button>
      </div>

      <AnimatePresence initial={false}>
        {tuning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-3">
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor={`${id}-len`} className="label-caps">
                  Length
                </label>
                <span className="nums font-display text-sm font-extrabold">{options.length}</span>
              </div>
              <input
                id={`${id}-len`}
                type="range"
                min={8}
                max={64}
                value={options.length}
                onChange={(event) => {
                  const next = { ...options, length: Number(event.target.value) }
                  setOptions(next)
                  if (value) roll(next)
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-pill bg-cream-400 accent-lime-500"
              />

              <div className="mt-3 flex flex-wrap gap-1.5">
                {CLASSES.map((entry) => {
                  const on = options[entry.id]
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => toggleClass(entry.id)}
                      aria-pressed={on}
                      className={[
                        'tactile nums inline-flex min-h-[34px] items-center rounded-pill border-2 px-3 text-xs font-extrabold transition-colors',
                        on
                          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                          : 'border-ink-900/15 bg-cream-50 text-ink-400',
                      ].join(' ')}
                    >
                      {entry.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
