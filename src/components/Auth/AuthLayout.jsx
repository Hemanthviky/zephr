import Icon3D from '../shared/Icon3D'
import Logo from '../shared/Logo'
import ThemeToggle from '../shared/ThemeToggle'
import { FOOD_COUNT } from '../../data/foodDatabase'

/**
 * The signed-out shell: the pitch, and a stacked card holding whichever form is
 * active.
 *
 * At 390px it's one column — pitch above, card below, decorative icons
 * suppressed until there's room. A tablet keeps the single column but stops
 * pretending to be a phone: bigger type, a wider card, and the module
 * breakdown that a 1024px-tall screen has room for. From `lg` it splits: the
 * pitch takes the left half at full size and the card sits beside it, because
 * a 420px column marooned in the middle of a desktop window is the single
 * clearest sign that nobody thought about this screen.
 *
 * The floating props are gated on *height*, not width. A phone held sideways
 * is 844px wide — wide enough for `sm` — and 390px tall, which is exactly
 * where an avocado parked at `top-24` lands on top of the password field.
 */

/**
 * All four modules, because the pitch is the only place a signed-out visitor
 * finds out what's behind the login — and two of these arrived after the page
 * was written, which left it selling half an app.
 *
 * Four entries is where a single column stops working: stacked at this body
 * length they run past the fold on a laptop and push the form off it. So they
 * pair up into two columns as soon as there's width for it, which also stops
 * any one of them reading as the main event and the rest as footnotes — they
 * really are four equals sharing a login.
 */
const MODULES = [
  {
    icon: 'salad',
    title: 'Calories',
    body: `${FOOD_COUNT} everyday foods, idli to burritos — macros landing against your daily goal.`,
  },
  {
    icon: 'moneywings',
    title: 'Money',
    body: 'What you spent, what’s left this month, where it went, and how six months compare.',
  },
  {
    icon: 'hospital',
    title: 'Intake',
    body: 'Every drink in millilitres and every dose, on one timeline with the hour it happened.',
  },
  {
    icon: 'pushpin',
    title: 'Notes',
    body: 'A pinboard for the loose ends, with a passphrase-locked vault for logins.',
  },
]

export default function AuthLayout({ mode, onSwitch, children }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden px-page pb-safe pt-safe">
      {/* Ambient 3D props. Suppressed on phones, where they'd crowd the form,
          and on any short screen, where they'd land on it.

          `short:hidden` rather than a height gate on the show rule: the
          height-based screens are declared after lg, so they sort last and win
          every tiebreak. That makes them a reliable way to *suppress* and an
          unreliable way to reveal — so suppressing is all they're asked to do. */}
      <Icon3D
        name="avocado"
        size={110}
        float
        className="pointer-events-none absolute -left-6 top-24 hidden opacity-90 sm:block lg:bottom-14 lg:left-6 lg:top-auto short:hidden"
      />
      {/* One prop per half of the app's job rather than two plates: an avocado
          on both sides read as a food app before the copy got a word in. */}
      <Icon3D
        name="coin"
        size={96}
        float
        className="pointer-events-none absolute -right-4 top-56 hidden opacity-90 sm:block lg:hidden short:hidden"
      />

      {/* The theme lives in the profile, which is behind the login — so signed
          out, this is the only way to it. Top-right and small: it's a
          convenience for whoever's phone is in dark mode, not a feature of the
          pitch. z-10 keeps it above the floating props. */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1120px] flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* ── Pitch ──────────────────────────────────────────────────────── */}
        <header className="mx-auto w-full max-w-[420px] pt-10 text-center md:max-w-[560px] lg:mx-0 lg:max-w-none lg:pt-0 lg:text-left">
          {/* No pill behind the lockup: the wordmark is lime with a black
              outline, and on a lime chip only the outline would read. */}
          <Logo size={46} className="mb-5" />

          {/* "Eat it. Spend it." named the two modules that existed when this
              was written; naming four wouldn't scan, and naming two of four
              undersells the rest. The rhythm survives by dropping to the verb
              the whole app shares — everything here is something that happened,
              written down. */}
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.92] tracking-tighter md:text-[3.4rem] lg:text-[4rem]">
            Live it. Log it.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">Know it.</span>
              <span className="absolute inset-x-[-6px] bottom-1 z-0 h-4 -rotate-1 rounded bg-lime-300 md:bottom-1.5 md:h-5 lg:bottom-2 lg:h-6" />
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-[19rem] text-[0.95rem] font-medium leading-snug text-ink-500 md:max-w-[26rem] md:text-base lg:mx-0 lg:mt-6 lg:text-lg">
            Calories, money, intake and notes — four trackers behind one login,
            with the whole day in one place. You type what happened; Zephr does
            the arithmetic and remembers it.
          </p>

          {/* The module breakdown needs a screen tall enough to carry it without
              pushing the form below the fold, which is the whole point of the
              page: a tablet upright, or any desktop that isn't a letterbox.
              Both rules resolve to `grid`, so the two can't fight over which
              of them the stylesheet emitted last. */}
          <ul className="mx-auto mt-8 hidden max-w-[34rem] grid-cols-2 gap-x-5 gap-y-5 text-left tall:md:grid lg:mx-0 lg:mt-9 lg:grid lg:max-w-none short:hidden">
            {MODULES.map((module) => (
              <li key={module.title} className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900/10 bg-cream-50 shadow-card">
                  <Icon3D name={module.icon} size={26} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold tracking-tight">
                    {module.title}
                  </p>
                  <p className="mt-0.5 text-[0.8rem] font-medium leading-snug text-ink-500">
                    {module.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </header>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <main className="mx-auto mt-8 w-full max-w-[420px] flex-1 md:max-w-[480px] lg:mx-0 lg:mt-0 lg:flex-none lg:justify-self-end">
          <div className="card-stacked">
            <div className="card p-5 sm:p-6 lg:p-8">
              {/* Segmented control: two equal 44px+ targets, no dropdown.
                  Only for the two modes it actually toggles between — the
                  password-reset screens aren't a third tab, they're somewhere
                  you were sent, and each carries its own way back. A tablist
                  with nothing selected would be both a lie to a screen reader
                  and an invitation to lose a half-typed reset. */}
              {(mode === 'login' || mode === 'signup') && (
                <div
                  role="tablist"
                  aria-label="Log in or sign up"
                  className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1"
                >
                  {[
                    ['login', 'Log in'],
                    ['signup', 'Sign up'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      role="tab"
                      type="button"
                      aria-selected={mode === value}
                      onClick={() => onSwitch(value)}
                      className={[
                        'min-h-[44px] rounded-xl font-display text-sm font-extrabold transition-all duration-150',
                        mode === value
                          ? 'bg-cream-50 text-ink-900 shadow-press-sm border-2 border-ink-900'
                          : 'text-ink-400 hover:text-ink-700',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {children}
            </div>
          </div>

          <p className="mx-auto mt-7 flex max-w-[21rem] items-center justify-center gap-2 text-center text-xs font-semibold leading-relaxed text-ink-400 lg:max-w-none">
            <Icon3D name="lock" size={18} />
            Your day is yours. Row-level security on every table, and vault
            passwords are encrypted before they leave your browser.
          </p>
        </main>
      </div>

      <footer className="py-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-ink-300 lg:absolute lg:bottom-0 lg:left-1/2 lg:-translate-x-1/2">
        Typed by hand, counted for you
      </footer>
    </div>
  )
}
