import { RotateCcw, Eye } from 'lucide-react'
import Button from '../shared/Button'
import ErrorShell from './ErrorShell'

/**
 * No connection — rendered as the sign a shop hangs on its door.
 *
 * "Offline" is the one error that isn't the app's fault and isn't the user's
 * either, so it shouldn't look like a failure. A hanging sign says the right
 * thing: the place is fine, it's just shut for a minute. It sways on the same
 * float animation the empty-state icons use, with the transform origin moved to
 * the top so it pivots from the string rather than drifting sideways.
 *
 * There's a dismiss, and that matters. Both modules keep already-fetched data
 * in memory, so a dropped connection doesn't stop you reading today's log —
 * trapping someone behind a full-screen takeover for a state they can still
 * partly use would be worse than the disconnection.
 */
export default function Offline({ onRetry, onDismiss }) {
  return (
    <ErrorShell
      actions={
        <>
          <Button size="lg" fullWidth icon={RotateCcw} onClick={onRetry ?? (() => window.location.reload())}>
            Try again
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="sm" fullWidth icon={Eye} onClick={onDismiss}>
              Look around anyway
            </Button>
          )}
        </>
      }
      footer="Zephr stores everything on Supabase rather than on this device, so new entries need a connection before they'll stick."
    >
      <div className="w-full max-w-[330px]">
        {/* The string. Ends land on the two punched holes below. */}
        <svg
          viewBox="0 0 200 54"
          className="mx-auto block w-full max-w-[240px]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M36 52 Q100 -4 164 52"
            stroke="rgb(var(--c-ink-300))"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="swing -mt-1 animate-float">
          <article className="relative mx-auto max-w-[240px] -rotate-[1.5deg] rounded-[1.25rem] border-[3px] border-ink-900 bg-cream-50 px-5 pb-6 pt-8 text-center shadow-lift">
            {/* Punched holes, aligned with where the string lands. */}
            <Hole className="left-[12%]" />
            <Hole className="right-[12%]" />

            <p className="font-display text-[0.7rem] font-extrabold uppercase tracking-[0.3em] text-ink-400">
              Sorry —
            </p>

            <h1 className="mt-2 font-display text-[2.5rem] font-extrabold uppercase leading-[0.86] tracking-tighter text-coral-500">
              We&rsquo;re
              <br />
              offline
            </h1>

            <div className="mx-auto my-4 h-[3px] w-14 rounded-full bg-ink-900/15" />

            <p className="text-[0.86rem] font-semibold leading-relaxed text-ink-700">
              Your device can&rsquo;t reach Zephr right now.
            </p>
            <p className="mt-2.5 text-[0.8rem] font-medium leading-relaxed text-ink-500">
              Everything already logged is still there. Anything new will wait until you&rsquo;re
              back.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-pill border-2 border-ink-900/10 bg-cream-200 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-coral-500" />
              </span>
              <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-ink-500">
                Watching for a signal
              </span>
            </div>
          </article>
        </div>
      </div>
    </ErrorShell>
  )
}

function Hole({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-3 h-[13px] w-[13px] rounded-full border-2 border-ink-900/20 bg-cream-200 shadow-inset ${className}`}
    />
  )
}
