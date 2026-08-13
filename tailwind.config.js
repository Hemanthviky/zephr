/** @type {import('tailwindcss').Config} */

// Zephr's design tokens live here, not scattered through className strings.
// Rules of the house:
//   • cream = every background. Never pure white, and in the dark theme the
//             same ramp runs the other way — cream-100 is the page, cream-50 the
//             card sitting on it, cream-200 the inset below it.
//   • ink   = every piece of text. Never #000, and never #FFF in the dark.
//   • lime  = the one thing on screen asking to be tapped.
//   • coral / tangerine / avocado = protein / carbs / fat, consistently, forever.
//
// Every colour below resolves through a CSS variable declared in index.css, in
// channel form (`27 25 21`) so Tailwind can still slot its own alpha into
// `border-ink-900/10`. That indirection is the whole dark theme: `.dark` on the
// html element redefines the variables and ~1,200 existing utility classes in
// this codebase change meaning without one of them being edited.
const channel = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(${name}))`
    : `rgb(var(${name}) / ${opacityValue})`

const ramp = (prefix, stops) =>
  Object.fromEntries(stops.map((stop) => [stop, channel(`--c-${prefix}-${stop}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Class, not media: the theme is a choice the user makes and we keep, and the
  // system preference is only ever the first guess. See hooks/useTheme.
  darkMode: 'class',
  future: {
    // A tablet or a phone reports `hover` on tap and then keeps the hover style
    // stuck on the last thing touched. Gate every hover: utility behind an
    // actual pointer so touch devices only ever see the :active press.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      // Height matters as much as width once a phone is turned sideways: a
      // landscape handset is ~390px tall, which is shorter than the progress
      // card alone. `short` trims the fixed chrome there; `tall` gates the
      // decoration that's only affordable on a real portrait screen.
      // `short` carries the orientation clause so it matches the media query
      // the layout variables in index.css use. Without it the two disagree the
      // moment an Android keyboard shrinks a portrait viewport past 600px:
      // the bar would restyle itself while the offset holding the dock above
      // it would not, and a sliver of page would show through the gap.
      screens: {
        short: { raw: '(max-height: 600px) and (orientation: landscape)' },
        tall: { raw: '(min-height: 760px)' },
      },
      colors: {
        // Semantic aliases the shadcn/neobrutalism registry components expect
        // (bg-muted, ring-background, bg-primary…). They point at the palette
        // below rather than introducing a second, grayer set of colours — a
        // dropped-in component should come out looking like the rest of Zephr.
        background: channel('--c-cream-50'),
        foreground: channel('--c-ink-900'),
        border: channel('--c-ink-900'),
        muted: channel('--c-cream-200'),
        'muted-foreground': channel('--c-ink-700'),
        primary: channel('--c-lime-500'),
        'primary-foreground': channel('--c-ink-on-accent'),
        cream: ramp('cream', [50, 100, 200, 300, 400]),
        ink: {
          DEFAULT: channel('--c-ink-900'),
          ...ramp('ink', [900, 700, 500, 400, 300]),
          // Text that sits *on* a saturated fill — a lime button, a coral chip.
          // It stays dark in both themes, because lime-400 stays lime-400.
          'on-accent': channel('--c-ink-on-accent'),
        },
        lime: ramp('lime', [100, 200, 300, 400, 500, 600, 700]),
        coral: ramp('coral', [100, 300, 500, 600]),
        tangerine: ramp('tangerine', [100, 300, 500, 600]),
        avocado: ramp('avocado', [100, 300, 500, 600]),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-rounded', 'Georgia', 'sans-serif'],
        // What the registry components call the display face.
        head: ['"Bricolage Grotesque"', 'ui-rounded', 'Georgia', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // One giant number is the whole point of the home screen. It sits
        // inside a fixed-width ring, so it scales with the viewport rather
        // than overflowing its own circle on a 320px phone.
        hero: [
          'clamp(3.4rem, 15vw, 4.25rem)',
          { lineHeight: '0.86', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
        // The money counterpart: same job, but a rupee figure runs longer than
        // a calorie one, so it tops out a little smaller.
        money: [
          'clamp(2.4rem, 11vw, 3.1rem)',
          { lineHeight: '0.86', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
        'money-long': [
          'clamp(2rem, 9vw, 2.6rem)',
          { lineHeight: '0.9', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
      },
      borderRadius: {
        card: '1.75rem',
        pill: '999px',
      },
      boxShadow: {
        // Tinted, never gray — in the light theme the shadow should look like
        // warm light rather than soot; in the dark one it goes to actual black,
        // because a brown glow under a card on a near-black page reads as a
        // smudge. Both live behind the same variables (index.css).
        card: '0 1px 0 0 var(--shadow-hairline), 0 14px 28px -18px var(--shadow-soft)',
        stack: '0 18px 34px -20px var(--shadow-soft-strong)',
        lift: '0 26px 50px -24px var(--shadow-soft-strong)',
        // Tactile buttons: a hard bottom edge that visibly compresses on press.
        press: '0 4px 0 0 var(--shadow-hard)',
        'press-sm': '0 3px 0 0 var(--shadow-hard)',
        'press-lime': '0 4px 0 0 var(--shadow-hard-lime)',
        'press-coral': '0 4px 0 0 var(--shadow-hard-coral)',
        inset: 'inset 0 2px 6px 0 var(--shadow-inset)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.96)' },
          '60%': { opacity: '1', transform: 'translateY(-3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'cheer': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '30%': { transform: 'scale(1.18) rotate(-6deg)' },
          '60%': { transform: 'scale(0.95) rotate(4deg)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-8px) rotate(2deg)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'rise': 'rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'cheer': 'cheer 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer': 'shimmer 1.6s infinite',
        'float': 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
