import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../hooks/useTheme'

/**
 * The light switch.
 *
 * Deliberately not the switch every app ships — a grey capsule with a white
 * dot in it, which tells you a boolean is on without ever saying *what* is on.
 * This one is a small window onto the sky: the knob is the sun, and pushing it
 * across drags the whole sky with it — lime daylight rolls out, warm night
 * rolls in, stars come up behind it, and the sun turns over into a moon on the
 * way. Read at a glance with the labels ignored entirely, which is how a
 * setting nobody reads should work.
 *
 * Everything inside is a literal colour rather than a palette class, and that's
 * on purpose: the rest of the app repaints when the theme flips, but a picture
 * of daytime has to look like daytime in *both* themes or the control ends up
 * arguing with itself. The frame — border, hard shadow, press — is the app's,
 * so it still sits in the same family as every other button.
 *
 * Mechanically it's a `role="switch"`, so a screen reader announces "Dark mode,
 * switch, on" and the space bar works. The visual is one span; the meaning is
 * on the button.
 */

const DAY_SKY = '#D8FC5E'
const NIGHT_SKY = '#171512'
const SUN = '#FFA51F'
const MOON = '#FFFDF7'
const CRATER = '#E2CDA4'
const INK = '#1B1915'

// Where the knob ends up: track (76) − border (2×2) − padding (2×3) − knob (32).
const TRAVEL = 34

// Fixed, hand-placed, and never random: a re-roll on every render would make
// the constellation shimmer whenever the profile sheet re-rendered.
const STARS = [
  { x: 11, y: 11, r: 1.6, delay: 0.05 },
  { x: 22, y: 24, r: 1.1, delay: 0.12 },
  { x: 30, y: 9, r: 1.9, delay: 0.02 },
  { x: 17, y: 31, r: 1.2, delay: 0.16 },
]

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useTheme()
  const still = useReducedMotion()

  // A spring is what sells the knob as a physical thing being shoved across;
  // with reduced motion it just arrives.
  const glide = still
    ? { duration: 0 }
    : { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={[
        'tactile relative h-[42px] w-[76px] shrink-0 overflow-hidden rounded-pill',
        'border-2 border-ink-900 p-[3px] shadow-press-sm',
        className,
      ].join(' ')}
    >
      {/* The sky. Two flat fills crossfading rather than an animated gradient,
          because a gradient between these two would spend half the transition
          as mud. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-pill"
        initial={false}
        animate={{ backgroundColor: isDark ? NIGHT_SKY : DAY_SKY }}
        transition={still ? { duration: 0 } : { duration: 0.32, ease: 'easeInOut' }}
      />

      {/* Stars, behind the knob and only at night. They scale up from nothing
          on a slight stagger, so the sky "comes up" instead of switching on. */}
      <span aria-hidden="true" className="absolute inset-0">
        {STARS.map((star) => (
          <motion.span
            key={`${star.x}-${star.y}`}
            className="absolute rounded-full bg-[#FFFDF7]"
            style={{
              left: star.x,
              top: star.y,
              width: star.r * 2,
              height: star.r * 2,
            }}
            initial={false}
            animate={{ opacity: isDark ? 0.9 : 0, scale: isDark ? 1 : 0.2 }}
            transition={
              still
                ? { duration: 0 }
                : { duration: 0.3, delay: isDark ? star.delay : 0, ease: 'easeOut' }
            }
          />
        ))}
      </span>

      {/* The knob: one disc that rolls across and turns over. The sun's rays
          live outside it and fade as it goes, so the shape narrows into a moon
          rather than morphing into one. */}
      <motion.span
        aria-hidden="true"
        // Fixed ink, not `border-ink-900`: that one goes near-white after dark,
        // which would erase the outline of a cream moon.
        style={{ borderColor: INK }}
        className="relative block h-8 w-8 rounded-full border-2"
        initial={false}
        animate={{
          x: isDark ? TRAVEL : 0,
          rotate: isDark ? 180 : 0,
          backgroundColor: isDark ? MOON : SUN,
        }}
        transition={glide}
      >
        {/* Rays. Struck *inside* the rim rather than poking out of it — the
            track clips at its own edge, and a sun with its left rays sheared
            off looks like a rendering bug rather than a sun. Eight of them, so
            it reads as a sunburst at 32px and not as a plus sign. */}
        <motion.span
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: isDark ? 0 : 1, rotate: isDark ? -45 : 0 }}
          transition={still ? { duration: 0 } : { duration: 0.24 }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <span
              key={angle}
              className="absolute left-1/2 top-1/2 h-[2.5px] w-[5px] rounded-pill"
              style={{
                background: INK,
                opacity: 0.7,
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(10px)`,
              }}
            />
          ))}
        </motion.span>

        {/* Craters. Counter-rotated so they sit upright once the knob has turned
            its half-circle — otherwise the moon arrives upside down. */}
        <motion.span
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: isDark ? 1 : 0, rotate: isDark ? 180 : 0 }}
          transition={still ? { duration: 0 } : { duration: 0.24, delay: isDark ? 0.1 : 0 }}
        >
          <span
            className="absolute left-[6px] top-[7px] h-[7px] w-[7px] rounded-full"
            style={{ background: CRATER }}
          />
          <span
            className="absolute right-[5px] top-[13px] h-[5px] w-[5px] rounded-full"
            style={{ background: CRATER }}
          />
          <span
            className="absolute bottom-[5px] left-[12px] h-[4px] w-[4px] rounded-full"
            style={{ background: CRATER }}
          />
        </motion.span>
      </motion.span>
    </button>
  )
}

/**
 * The switch with its label and its escape hatch — what the profile sheet
 * actually mounts.
 *
 * The escape hatch matters more than it looks: touching the switch at all pins
 * the theme to this device forever, and there is otherwise no way back to
 * "whatever my phone is doing", which is what most people actually want and
 * what everyone starts on. It only appears once there's something to undo.
 */
export function ThemeToggleRow() {
  const { isDark, preference, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-extrabold leading-tight">
          {isDark ? 'Night' : 'Day'}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-ink-400">
          {preference === 'system' ? (
            'Following your device'
          ) : (
            <button
              type="button"
              onClick={() => setTheme(null)}
              className="font-semibold underline decoration-ink-300 underline-offset-2 hover:text-ink-700"
            >
              Follow my device instead
            </button>
          )}
        </p>
      </div>
      <ThemeToggle />
    </div>
  )
}
