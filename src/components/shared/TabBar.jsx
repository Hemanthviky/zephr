import { motion } from 'framer-motion'
import Icon3D from './Icon3D'
import Logo from './Logo'
import Avatar from './Avatar'

/**
 * The app's modules, in whichever navigation the screen calls for.
 *
 * Under `lg` it's a bottom bar: thumb-reachable, and on a phone it sits below
 * each module's own docked action button (which is offset to clear it), so
 * switching tabs and logging something never leave the bottom third of the
 * screen. From `md` the modules move that button inline and the bar is the
 * only fixed thing left down there. It holds the modules and nothing else —
 * profile is not a module, and squeezing an avatar in beside the tabs made it
 * read as one. On phones that lives in the module header instead, top-right,
 * where an account has lived on mobile for a decade.
 *
 * The mobile tiles stack their icon over their label. Side by side is the
 * better shape and it survived exactly two modules: a third left ~100px per
 * tile on a 360px phone, which is not enough for an icon, a gap and the word
 * "Hospital" on one line. A fourth takes that to ~77px, so the labels truncate
 * rather than wrap — the icon is doing most of the identifying at that size
 * anyway, and a bar whose tiles are two lines tall on some phones and one on
 * others is worse than a clipped word.
 *
 * From `lg` up a bottom bar is wrong — the pointer is nowhere near the bottom
 * of a 1440px window, and a full-width strip of chrome wastes the one thing a
 * desktop has spare, which is horizontal room. So it becomes a fixed left rail
 * instead, and the modules lay themselves out in the space beside it.
 *
 * Both render into the DOM at once (visibility is a media query, not a branch),
 * so the two active pills need distinct layoutIds — sharing one would make
 * framer-motion animate the pill between a hidden element and a visible one.
 */

const TABS = [
  { id: 'food', label: 'Food', icon: 'salad', blurb: 'Calories & macros' },
  { id: 'money', label: 'Money', icon: 'moneywings', blurb: 'Spending & budgets' },
  { id: 'hospital', label: 'Hospital', icon: 'hospital', blurb: 'Fluids & medicines' },
  { id: 'notes', label: 'Notes', icon: 'pushpin', blurb: 'Jottings & passwords' },
]

/**
 * Height of the mobile bar, excluding the safe-area inset: pt-2 + a 48px
 * target + .pb-safe's 16px. The layout reads this from `--tabbar-h` in
 * index.css, which is the value that has to stay in step with the markup
 * below — this constant is here for anything that needs the number in JS.
 */
export const TAB_BAR_HEIGHT = 72

/** Width of the desktop rail. Modules offset their content by this at lg. */
export const SIDEBAR_WIDTH = 248

export default function TabBar({ value, onChange, userName = '', userEmail = '', onOpenProfile }) {
  return (
    <>
      {/* ── Mobile: bottom bar ───────────────────────────────────────────── */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink-900/10 bg-cream-50/95 backdrop-blur-md pb-safe lg:hidden"
      >
        <div className="mx-auto flex w-full max-w-[540px] items-stretch gap-1.5 px-page pt-2 short:pt-1">
          {TABS.map((tab) => {
            const active = value === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className="relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 short:min-h-[44px] short:flex-row short:gap-1.5"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill-mobile"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm"
                  />
                )}

                <Icon3D name={tab.icon} size={active ? 22 : 20} className="relative z-10" />
                <span
                  className={[
                    'relative z-10 w-full truncate text-center font-display text-[0.68rem] font-extrabold leading-none tracking-tight transition-colors short:text-xs',
                    active ? 'text-ink-900' : 'text-ink-400',
                  ].join(' ')}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}

        </div>
      </nav>

      {/* ── Desktop: left rail ─────────────────────────────────────────────
          It scrolls: a laptop in a short window (or a browser wearing three
          toolbars) can leave less height than the rail's own content. */}
      <nav
        aria-label="Sections"
        className="no-scrollbar fixed inset-y-0 left-0 z-50 hidden w-[248px] flex-col overflow-y-auto border-r-2 border-ink-900/10 bg-cream-50 px-4 py-7 lg:flex"
      >
        <Logo size={42} className="mb-8 px-2" />

        <div className="flex flex-col gap-2">
          {TABS.map((tab) => {
            const active = value === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className="relative flex min-h-[60px] items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-cream-100"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill-desktop"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm"
                  />
                )}

                <span className="relative z-10 flex min-w-0 items-center gap-3">
                  <Icon3D name={tab.icon} size={30} />
                  <span className="min-w-0">
                    <span
                      className={[
                        'block font-display text-base font-extrabold leading-tight tracking-tight transition-colors',
                        active ? 'text-ink-900' : 'text-ink-500',
                      ].join(' ')}
                    >
                      {tab.label}
                    </span>
                    <span
                      className={[
                        'block truncate text-[0.7rem] font-bold transition-colors',
                        active ? 'text-ink-700' : 'text-ink-300',
                      ].join(' ')}
                    >
                      {tab.blurb}
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* The rail has room a bottom bar doesn't, so desktop gets the whole
            identity — monogram, name, email — as the way in. */}
        {onOpenProfile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="tactile mt-auto flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-100 px-3 text-left transition-colors hover:border-ink-900/30"
          >
            <Avatar name={userName} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-sm font-extrabold leading-tight">
                {userName}
              </span>
              <span className="block truncate text-[0.7rem] font-semibold text-ink-400">
                {userEmail}
              </span>
            </span>
          </button>
        ) : (
          <p className="mt-auto px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink-300">
            Typed by hand,
            <br />
            counted for you
          </p>
        )}
      </nav>
    </>
  )
}
