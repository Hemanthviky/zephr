import { motion } from 'framer-motion'
import Icon3D from './Icon3D'

/**
 * The app's two modules, docked to the bottom of the screen.
 *
 * Sits below each module's own primary action button (which is offset to clear
 * it), so the thumb never has to leave the bottom third of the phone: switch
 * tabs on the very bottom row, log something on the row above.
 *
 * The active pill is a shared layout animation, so switching slides rather than
 * cuts — the two tabs read as one control, not two buttons.
 */

const TABS = [
  { id: 'food', label: 'Food', icon: 'salad' },
  { id: 'money', label: 'Money', icon: 'moneywings' },
]

/** Height of the bar, excluding the safe-area inset. Kept in sync with .pb-dock. */
export const TAB_BAR_HEIGHT = 64

export default function TabBar({ value, onChange }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink-900/10 bg-cream-50/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto flex w-full max-w-[520px] items-stretch gap-2 px-4 pt-2">
        {TABS.map((tab) => {
          const active = value === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-3"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm"
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <Icon3D name={tab.icon} size={active ? 24 : 21} />
                <span
                  className={[
                    'font-display text-sm font-extrabold tracking-tight transition-colors',
                    active ? 'text-ink-900' : 'text-ink-400',
                  ].join(' ')}
                >
                  {tab.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
