import { useMemo } from 'react'
import { RotateCcw, RefreshCw } from 'lucide-react'
import Button from '../shared/Button'
import ErrorShell from './ErrorShell'

/**
 * The unexpected-error screen — rendered as a till receipt that didn't total.
 *
 * A crash in a tracking app raises exactly one question: "did I just lose what
 * I logged?" A receipt answers that better than a paragraph can, because a
 * receipt's whole job is itemising what did and didn't happen. So the failure
 * gets printed as line items, and the two lines that matter — nothing lost,
 * nothing charged — sit where the amounts would be.
 *
 * This file deliberately imports almost nothing. It renders when the rest of
 * the app has already thrown, so every extra dependency is another thing that
 * could take the error screen down with it. No currency helper, no Icon3D, no
 * framer-motion: paper, ink, and two buttons.
 */
export default function CrashScreen({ error, onRetry, canRetry = true }) {
  // Fixed at mount. A ref that changed on every re-render would be useless to
  // quote, and the timestamp should say when it broke, not when React repainted.
  const { ref, stamp } = useMemo(() => {
    const now = new Date()
    return {
      ref: refFor(error),
      stamp: {
        date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    }
  }, [error])

  const message = (error?.message || 'Unknown error').trim()

  return (
    <ErrorShell
      actions={
        <>
          {canRetry && (
            <Button size="lg" fullWidth icon={RotateCcw} onClick={onRetry}>
              Try that again
            </Button>
          )}
          <Button
            variant={canRetry ? 'secondary' : 'primary'}
            size={canRetry ? 'md' : 'lg'}
            fullWidth
            icon={RefreshCw}
            onClick={() => window.location.reload()}
          >
            Reload Zephr
          </Button>
        </>
      }
      footer="If it keeps happening, quote the reference above — it's printed from the error itself."
    >
      {/* The shadow lives on the wrapper: the receipt itself is masked into a
          torn edge, and a mask clips box-shadow along with everything else. */}
      <div
        className="w-full max-w-[330px] animate-rise"
        style={{ filter: 'drop-shadow(0 20px 34px rgba(122,84,25,0.45))' }}
      >
        <article className="receipt bg-cream-50 px-6 pb-9 pt-10 font-mono text-[0.72rem] font-medium leading-relaxed text-ink-700">
          <p className="text-center font-display text-sm font-extrabold uppercase tracking-[0.34em] text-ink-900">
            Zephr
          </p>
          <p className="mt-0.5 text-center text-[0.62rem] uppercase tracking-[0.18em] text-ink-400">
            Personal Tracking Co.
          </p>

          <Tear />

          <h1 className="text-center font-display text-[1.9rem] font-extrabold uppercase leading-[0.92] tracking-tighter text-ink-900">
            Something
            <br />
            didn&rsquo;t add up
          </h1>

          <Tear />

          <Line label="Date" value={stamp.date} />
          <Line label="Time" value={stamp.time} />
          <Line label="Ref" value={`#${ref}`} />

          <Tear />

          <div className="flex justify-between text-[0.62rem] uppercase tracking-[0.12em] text-ink-400">
            <span>Item</span>
            <span>Status</span>
          </div>
          <div className="mt-1.5">
            <Line label="1 × This screen" value="FAILED" tone="bad" />
            <Line label="0 × Entries lost" value="NONE" />
            <Line label="0 × Money moved" value="NONE" />
          </div>

          <Tear />

          <div className="flex items-baseline justify-between font-display text-base font-extrabold uppercase tracking-tight text-ink-900">
            <span>Total damage</span>
            <span className="nums">0.00</span>
          </div>

          <Tear />

          <p className="text-[0.62rem] uppercase tracking-[0.12em] text-ink-400">Reason</p>
          <p className="mt-1 break-words text-[0.7rem] font-semibold text-coral-600">{message}</p>

          {import.meta.env.DEV && error?.stack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[0.62rem] uppercase tracking-[0.12em] text-ink-400">
                Stack (dev only)
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[0.6rem] leading-relaxed text-ink-500">
                {error.stack}
              </pre>
            </details>
          )}

          <Tear />

          <p className="text-center text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-900">
            ** Nothing was lost **
          </p>
          <p className="mt-1.5 text-center text-[0.68rem] leading-relaxed">
            Everything you logged before this is safely in the database. This screen broke; your
            day didn&rsquo;t.
          </p>

          <Barcode seed={ref} />
          <p className="mt-1.5 text-center text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
            ERR-{ref}
          </p>
        </article>
      </div>
    </ErrorShell>
  )
}

/** A dotted rule, the way a thermal printer separates blocks. */
function Tear() {
  return <div className="my-3 border-t-2 border-dotted border-ink-900/30" aria-hidden="true" />
}

function Line({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="uppercase tracking-[0.06em]">{label}</span>
      <span
        className={`nums font-bold ${tone === 'bad' ? 'text-coral-600' : 'text-ink-900'}`}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * A barcode that encodes nothing — it's the visual full stop a receipt needs to
 * read as a receipt. Bar widths come from the reference string, so the same
 * error always prints the same code and it never flickers on re-render.
 */
function Barcode({ seed }) {
  const bars = useMemo(() => {
    const out = []
    for (let i = 0; i < 44; i += 1) {
      const n = seed.charCodeAt(i % seed.length) + i * 7
      out.push({ w: (n % 3) + 1, gap: (n % 2) + 1 })
    }
    return out
  }, [seed])

  return (
    <div className="mt-6 flex h-10 items-end justify-center gap-[2px]" aria-hidden="true">
      {bars.map((bar, i) => (
        <span
          key={i}
          className="h-full bg-ink-900"
          style={{ width: bar.w, marginRight: bar.gap }}
        />
      ))}
    </div>
  )
}

/** Six hex characters, derived from the message so it's reproducible. */
function refFor(error) {
  const input = `${error?.name || 'Error'}:${error?.message || ''}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(0, 6)
}
