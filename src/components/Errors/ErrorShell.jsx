/**
 * The frame every error page sits in.
 *
 * Errors are the one screen a user reaches by accident, so they get the same
 * cream page and the same tactile buttons as everywhere else — the app hasn't
 * turned into a different, colder website just because something broke. What
 * changes is the artefact in the middle: each error renders as a document Zephr
 * would plausibly print. A label, a receipt, a sign.
 *
 * No TabBar here on purpose. Every one of these states means "you can't get on
 * with logging right now", and offering the tabs would be a lie.
 */
export default function ErrorShell({ children, actions, footer }) {
  return (
    <main
      role="main"
      // min-h rather than h, so a tall artefact (the crash receipt) grows the
      // page and scrolls instead of being centred into a clipped overflow.
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-page py-14 short:gap-5 short:py-8"
    >
      {children}

      {actions && (
        <div className="flex w-full max-w-[330px] flex-col gap-2.5">{actions}</div>
      )}

      {footer && (
        <p className="max-w-[25rem] text-balance text-center text-xs font-semibold leading-relaxed text-ink-400">
          {footer}
        </p>
      )}
    </main>
  )
}
