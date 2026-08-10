/** @type {import('tailwindcss').Config} */

// Zephr's design tokens live here, not scattered through className strings.
// Rules of the house:
//   • cream = every background. Never a dark surface, never pure white.
//   • ink   = every piece of text. Never #000.
//   • lime  = the one thing on screen asking to be tapped.
//   • coral / tangerine / avocado = protein / carbs / fat, consistently, forever.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFDF7',
          100: '#FDF7EA',
          200: '#F7EDD8',
          300: '#EFE0C2',
          400: '#E2CDA4',
        },
        ink: {
          DEFAULT: '#1B1915',
          900: '#1B1915',
          700: '#403A31',
          500: '#6E6659',
          400: '#948B7B',
          300: '#BDB4A2',
        },
        lime: {
          100: '#F2FFC7',
          200: '#E6FF94',
          300: '#D8FC5E',
          400: '#C6F32B',
          500: '#AEDC0B', // primary accent
          600: '#8CB300',
          700: '#657F04',
        },
        coral: {
          100: '#FFE4DC',
          300: '#FF9E85',
          500: '#FF5A38', // over budget / protein
          600: '#E33E1C',
        },
        tangerine: {
          100: '#FFEFCE',
          300: '#FFCB6B',
          500: '#FFA51F', // carbs
          600: '#E08600',
        },
        avocado: {
          100: '#D6F5EC',
          300: '#6FD9C2',
          500: '#12B39A', // fat
          600: '#0C8F7B',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-rounded', 'Georgia', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // One giant number is the whole point of the home screen.
        hero: ['4.25rem', { lineHeight: '0.86', letterSpacing: '-0.04em', fontWeight: '800' }],
      },
      borderRadius: {
        card: '1.75rem',
        pill: '999px',
      },
      boxShadow: {
        // Tinted, never gray — the shadow should look like warm light, not soot.
        card: '0 1px 0 0 rgba(27,25,21,0.06), 0 14px 28px -18px rgba(122,84,25,0.55)',
        stack: '0 18px 34px -20px rgba(122,84,25,0.65)',
        lift: '0 26px 50px -24px rgba(122,84,25,0.7)',
        // Tactile buttons: a hard bottom edge that visibly compresses on press.
        press: '0 4px 0 0 #1B1915',
        'press-sm': '0 3px 0 0 #1B1915',
        'press-lime': '0 4px 0 0 #657F04',
        'press-coral': '0 4px 0 0 #B32E13',
        inset: 'inset 0 2px 6px 0 rgba(27,25,21,0.08)',
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
