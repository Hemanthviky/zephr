/**
 * The Zephr logo.
 *
 * Two artefacts, kept apart on purpose:
 *
 *   <LogoMark />     the symbol alone — a lime disc with the ribbon cut
 *                    through it. Square, and legible down to about 20px.
 *   <Wordmark />     the name set as artwork, not as live type.
 *   <Logo />         the two locked up side by side, which is the form
 *                    every header and the sign-in page use.
 *
 * Both are WebP out of `public/`, sized for the largest place they appear and
 * no larger: the mark at 224px against a 76px boot screen, the wordmark at
 * 256px wide against a 24px line of type — 3× on the densest phone panel, and
 * 20KB for the pair where the PNGs were 143KB. They carry their own black
 * outline and lime fill, so neither wants a tile or a border behind it: put
 * the mark on a lime chip and the outline is all that survives.
 *
 * Sizing is by height in pixels rather than a Tailwind class because the
 * intrinsic `width`/`height` attributes have to agree with what's rendered, or
 * the header jumps by a few pixels while the image decodes.
 */

const MARK_SRC = '/zephr-mark.webp'
const WORDMARK_SRC = '/zephr-wordmark.webp'

// 256 × 101 in the file. Anything that reserves space for the wordmark needs
// this to work out the width from the height it was given.
const WORDMARK_RATIO = 256 / 101

/** The symbol on its own. `alt=""` by default — pair it with a Wordmark and
 *  only one of the two should be announced. */
export function LogoMark({ size = 40, className = '', float = false, alt = '' }) {
  const decorative = alt === ''

  return (
    <img
      src={MARK_SRC}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      decoding="async"
      // Never lazy: the logo sits in the header of every screen, so it is
      // always above the fold, and deferring it only pushes it past first
      // paint. Small enough that fetching it early costs nothing.
      loading="eager"
      // Lowercase on purpose. React only learned the camelCase `fetchPriority`
      // prop in v19; on the v18 we're on it warns and drops the attribute, so
      // the browser never sees the hint. Spelled this way it passes straight
      // through, which is all we wanted.
      fetchpriority="high"
      className={['inline-block shrink-0 select-none', float ? 'animate-float' : '', className]
        .join(' ')
        .trim()}
      style={{ width: size, height: size }}
    />
  )
}

/** The name. Sized by height; the width follows from the artwork's ratio. */
export function Wordmark({ height = 22, className = '', alt = 'Zephr' }) {
  const decorative = alt === ''

  return (
    <img
      src={WORDMARK_SRC}
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      alt={alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      decoding="async"
      loading="eager"
      fetchpriority="high"
      className={['inline-block shrink-0 select-none', className].join(' ').trim()}
      style={{ height, width: 'auto' }}
    />
  )
}

/**
 * The lockup: symbol, then name, optically balanced.
 *
 * `size` is the mark's height; the wordmark sits at roughly half of it, which
 * is what lands its x-height on the disc's middle band rather than towering
 * over it.
 */
export default function Logo({ size = 40, className = '', alt = 'Zephr' }) {
  return (
    <span className={['inline-flex items-center', className].join(' ').trim()}>
      <LogoMark size={size} />
      <Wordmark height={Math.round(size * 0.52)} alt={alt} className="ml-[0.45em]" />
    </span>
  )
}
