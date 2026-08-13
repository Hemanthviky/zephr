import { useTheme } from '../../hooks/useTheme'

/**
 * The light switch.
 *
 * Deliberately not the switch every app ships — a grey capsule with a white
 * dot in it, which tells you a boolean is on without ever saying *what* is on.
 * This one is a small window onto the sky, and flipping it runs a whole day
 * past: the sun rolls across and turns over into a moon, the daylight sky
 * drains to night behind it, two clouds slide off the way they came, and the
 * stars come up in the space the moon just left. Read at a glance with the
 * labels ignored entirely, which is how a setting nobody reads should work.
 *
 * Everything inside is a literal colour rather than a palette class, and that's
 * on purpose: the rest of the app repaints when the theme flips, but a picture
 * of daytime has to look like daytime in *both* themes or the control ends up
 * arguing with itself. The frame — border, hard shadow, press — is the app's,
 * so it still sits in the same family as every other button.
 *
 * ── How it moves ──────────────────────────────────────────────────────────
 *
 * Every one of those pieces used to be a framer-motion element with its own
 * `animate` prop — nine of them, each running a JS-driven animation on the main
 * thread, in a control that is mounted two or three times over (sign-in page,
 * desktop rail, profile sheet) and sits on screen permanently.
 *
 * It's all CSS transitions now, hung off one `data-night` attribute on the
 * button. The children read that with `group-data-[night=true]:`, so a click
 * flips a single attribute and the browser interpolates the rest off the main
 * thread — transform and opacity throughout, which are the two properties it
 * can composite without repainting. Zero JS per frame, and nothing to tear down
 * when the button unmounts.
 *
 * Two knock-on simplifications came free with it. `useReducedMotion` is gone,
 * because `motion-reduce:transition-none` is the same rule stated where it
 * belongs and costs no subscription. And so is framer-motion's `initial={false}`
 * dance: a CSS transition can't fire on mount, so a page loaded in dark mode
 * simply *is* dark rather than animating there.
 *
 * The two colours that depend on state ride on custom properties set on the
 * button. That keeps every colour in the block below — none of them get
 * scattered into Tailwind arbitrary values — and it lets the sky be one element
 * interpolating its own background rather than two crossfading.
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
const CLOUD = '#FFFDF7'
const INK = '#1B1915'

/**
 * The knob travels `translate-x-[34px]`: track (76) − border (2×2) − padding
 * (2×3) − knob (32). It's written literally in the class list below because
 * Tailwind reads these files as text and can't see through a constant — same
 * reason the stagger delays are spelled out in the arrays rather than computed.
 *
 * Everything positioned below is in the padding box, which is 72 × 38.
 */

// Fixed, hand-placed, and never random: a re-roll on every render would make
// the constellation shimmer whenever the profile sheet re-rendered. All of them
// live left of x≈35, which is the half of the sky the moon has vacated by the
// time they're visible.
const STARS = [
  { x: 10, y: 9, r: 1.7, delay: 'group-data-[night=true]:delay-[40ms]' },
  { x: 29, y: 8, r: 1.9, delay: 'group-data-[night=true]:delay-[20ms]' },
  { x: 21, y: 22, r: 1.1, delay: 'group-data-[night=true]:delay-[120ms]' },
  { x: 16, y: 29, r: 1.2, delay: 'group-data-[night=true]:delay-[160ms]' },
  { x: 6, y: 19, r: 1.0, delay: 'group-data-[night=true]:delay-[220ms]' },
]

/**
 * Clouds. A pill with a smaller disc shouldered onto it, the disc drawn as a
 * `::before` so each cloud is one element rather than two.
 *
 * They sit in the right half — the half the sun *hasn't* reached yet — so the
 * day state reads as a sky with something in it rather than a dot on a field,
 * and the moon can move into that space once they've gone.
 */
const CLOUDS = [
  {
    style: { left: 40, top: 8, width: 20, height: 8 },
    bump: "before:content-[''] before:absolute before:-top-[5px] before:left-1 before:h-[11px] before:w-[11px] before:rounded-full before:bg-inherit",
    delay: '',
  },
  {
    style: { left: 53, top: 22, width: 13, height: 6 },
    bump: "before:content-[''] before:absolute before:-top-[3px] before:left-[3px] before:h-[7px] before:w-[7px] before:rounded-full before:bg-inherit",
    delay: 'group-data-[night=true]:delay-[60ms]',
  },
]

// Eight, so it reads as a sunburst at 32px rather than as a plus sign.
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

const CRATERS = [
  { left: 6, top: 7, size: 7 },
  { right: 5, top: 13, size: 5 },
  { left: 12, bottom: 5, size: 4 },
]

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useTheme()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      // The one thing that actually changes on a click. Everything inside is a
      // descendant selector away from it.
      data-night={isDark ? 'true' : 'false'}
      style={{
        '--sky': isDark ? NIGHT_SKY : DAY_SKY,
        '--knob': isDark ? MOON : SUN,
      }}
      className={[
        'group tactile relative h-[42px] w-[76px] shrink-0 overflow-hidden rounded-pill',
        'border-2 border-ink-900 p-[3px] shadow-press-sm',
        className,
      ].join(' ')}
    >
      {/* The sky. One element interpolating its own background between the two
          literals — a gradient between them would spend half the transition as
          mud, and two stacked layers crossfading is a second element for the
          same result. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-pill transition-colors duration-300 ease-in-out motion-reduce:transition-none"
        style={{ backgroundColor: 'var(--sky)' }}
      />

      {/* Haze along the bottom of the daylight sky. Static, subtle, and the only
          thing here giving the scene a floor — without it the sun reads as
          floating in flat colour. Gone by night, when there's nothing to catch
          the light. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3 transition-opacity duration-300 group-data-[night=true]:opacity-0 motion-reduce:transition-none"
        style={{ background: `linear-gradient(to top, ${SUN}59, transparent)` }}
      />

      {/* Clouds, drifting out to the left as the light goes. */}
      {CLOUDS.map((cloud) => (
        <span
          key={cloud.style.left}
          aria-hidden="true"
          // The resting opacity is a class, not an inline `opacity` — an inline
          // one would outrank the night rule and the clouds would never leave.
          className={[
            'absolute rounded-pill opacity-90 transition-[transform,opacity] duration-300 ease-out',
            'group-data-[night=true]:-translate-x-4 group-data-[night=true]:opacity-0',
            cloud.bump,
            cloud.delay,
            'motion-reduce:transition-none',
          ].join(' ')}
          style={{ ...cloud.style, backgroundColor: CLOUD }}
        />
      ))}

      {/* Stars, behind the knob and only at night. They scale up from nothing on
          a slight stagger, so the sky "comes up" instead of switching on. The
          delay is carried only by the night rule, so going back to day takes
          them all out at once. */}
      {STARS.map((star) => (
        <span
          key={`${star.x}-${star.y}`}
          aria-hidden="true"
          className={[
            'absolute scale-[0.2] rounded-full opacity-0 transition-[transform,opacity] duration-300 ease-out',
            'group-data-[night=true]:scale-100 group-data-[night=true]:opacity-90',
            star.delay,
            'motion-reduce:transition-none',
          ].join(' ')}
          style={{
            left: star.x,
            top: star.y,
            width: star.r * 2,
            height: star.r * 2,
            backgroundColor: MOON,
          }}
        />
      ))}

      {/* The knob: one disc that rolls across and turns over.
          The easing overshoots slightly on the way — that shove past the mark
          and back is what a spring was doing here, and it's the whole reason
          the thing feels physical. Kept under ~2px of overshoot so the disc
          never kisses the inside of the track. */}
      <span
        aria-hidden="true"
        // Fixed ink, not `border-ink-900`: that one goes near-white after dark,
        // which would erase the outline of a cream moon.
        style={{ borderColor: INK, backgroundColor: 'var(--knob)' }}
        className={[
          'relative block h-8 w-8 rounded-full border-2',
          'transition-[transform,background-color] duration-500 ease-[cubic-bezier(.34,1.4,.64,1)]',
          'group-data-[night=true]:translate-x-[34px] group-data-[night=true]:rotate-180',
          'motion-reduce:transition-none',
        ].join(' ')}
      >
        {/* Rays. Struck *inside* the rim rather than poking out of it — the
            track clips at its own edge, and a sun with its left rays sheared
            off looks like a rendering bug rather than a sun. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 transition-[transform,opacity] duration-200 group-data-[night=true]:-rotate-45 group-data-[night=true]:opacity-0 motion-reduce:transition-none"
        >
          {RAYS.map((angle) => (
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
        </span>

        {/* Craters. Counter-rotated so they sit upright once the knob has turned
            its half-circle — otherwise the moon arrives upside down. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-0 transition-[transform,opacity] duration-200 group-data-[night=true]:rotate-180 group-data-[night=true]:opacity-100 group-data-[night=true]:delay-100 motion-reduce:transition-none"
        >
          {CRATERS.map(({ size, ...edges }) => (
            <span
              key={`${edges.left ?? edges.right}-${edges.top ?? edges.bottom}`}
              className="absolute rounded-full"
              style={{ ...edges, width: size, height: size, background: CRATER }}
            />
          ))}
        </span>
      </span>
    </button>
  )
}

/**
 * The switch with its label — what the profile sheet actually mounts.
 *
 * There used to be a "follow my device instead" link under it, back when an
 * untouched app followed `prefers-color-scheme`. Nothing follows the device
 * now: the app opens in day and stays there until this switch says otherwise,
 * so there is no third state to explain and nothing to hand back to.
 */
export function ThemeToggleRow() {
  const { isDark } = useTheme()

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-extrabold leading-tight">
          {isDark ? 'Night' : 'Day'}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-ink-400">
          {isDark ? 'Remembered on this device' : 'Zephr opens in day'}
        </p>
      </div>
      <ThemeToggle />
    </div>
  )
}
