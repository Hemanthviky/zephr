import Icon3D from '../shared/Icon3D'
import { FOOD_COUNT } from '../../data/foodDatabase'

/**
 * The signed-out shell: brand mark, one-line pitch, and a stacked card holding
 * whichever form is active. Mobile-first — at 390px this is a single column
 * with the card filling the width; the decorative floating icons only appear
 * once there's room for them.
 */
export default function AuthLayout({ mode, onSwitch, children }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden px-5 pb-safe pt-safe">
      {/* Ambient 3D food, sized down to nothing on small screens. */}
      <Icon3D
        name="avocado"
        size={110}
        float
        className="pointer-events-none absolute -left-6 top-24 hidden opacity-90 sm:block"
      />
      <Icon3D
        name="curry"
        size={96}
        float
        className="pointer-events-none absolute -right-4 top-56 hidden opacity-90 sm:block"
      />

      <header className="mx-auto w-full max-w-[420px] pt-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-pill border-2 border-ink-900 bg-lime-400 px-4 py-2 shadow-press-lime">
          <Icon3D name="salad" size={22} />
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.2em]">
            Zephr
          </span>
        </div>

        <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.92] tracking-tighter">
          Eat it.
          <br />
          <span className="relative inline-block">
            <span className="relative z-10">Log it.</span>
            <span className="absolute inset-x-[-6px] bottom-1 z-0 h-4 -rotate-1 rounded bg-lime-300" />
          </span>{' '}
          Know it.
        </h1>

        <p className="mx-auto mt-4 max-w-[19rem] text-[0.95rem] font-medium leading-snug text-ink-500">
          Calories and macros for {FOOD_COUNT} everyday foods — from idli to
          burritos — the second you log them.
        </p>
      </header>

      <main className="mx-auto mt-8 w-full max-w-[420px] flex-1">
        <div className="card-stacked">
          <div className="card p-5 sm:p-6">
            {/* Segmented control: two equal 44px+ targets, no dropdown. */}
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

            {children}
          </div>
        </div>

        <p className="mx-auto mt-7 flex max-w-[19rem] items-center justify-center gap-2 text-center text-xs font-semibold leading-relaxed text-ink-400">
          <Icon3D name="lock" size={18} />
          Your log is yours. Row-level security means nobody else can read it.
        </p>
      </main>

      <footer className="py-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-ink-300">
        Made for people who actually eat
      </footer>
    </div>
  )
}
