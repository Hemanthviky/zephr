import { useState } from 'react'

/**
 * 3D icon.
 *
 * Renders a Fluent Emoji 3D asset (Microsoft, MIT-licensed) for the app's key
 * visual moments — empty states, the add button, macro headers, goal
 * celebrations. If the file can't be fetched it falls back to the platform's
 * own colour emoji glyph, which is the same artwork family, so the layout
 * never collapses into a broken-image box.
 *
 * These used to be pulled straight off jsDelivr as the upstream 512px PNGs:
 * ~31KB each, for icons drawn as small as 18px, from a third party we then had
 * to open a connection to. They're served from `public/icons/` now as 256px
 * WebP, which is ~4KB each — a seventh of the bytes, on a connection the page
 * already has. `scripts/fetch-icons.mjs` regenerates the folder and holds the
 * upstream names; the map below only needs the fallback glyph.
 *
 * Small inline UI chrome (chevrons, trash, close) uses lucide-react instead —
 * a 3D render of a chevron would be absurd.
 */

// icon name -> unicode fallback
const ICONS = {
  plate: '🍽️',
  salad: '🥗',
  avocado: '🥑',
  bread: '🍞',
  butter: '🧈',
  meat: '🍗',
  fire: '🔥',
  target: '🎯',
  party: '🎉',
  sparkles: '✨',
  star: '🌟',
  search: '🔍',
  cooking: '🍳',
  curry: '🍛',
  gear: '⚙️',
  lock: '🔒',
  seedling: '🌱',
  chart: '📈',
  bulb: '💡',
  moon: '🌙',

  // Money module — expense categories, wallets and empty states.
  burger: '🍔',
  bus: '🚌',
  house: '🏠',
  shopping: '🛍️',
  clapper: '🎬',
  pill: '💊',
  cart: '🛒',
  receipt: '🧾',
  coin: '🪙',
  banknote: '💵',
  moneybag: '💰',
  moneywings: '💸',
  card: '💳',
  bank: '🏦',
  purse: '👛',
  gift: '🎁',
  books: '📚',
  plane: '✈️',
  phone: '📱',
  chartdown: '📉',

  // Hospital module — the fluid chart and the drug chart.
  droplet: '💧',
  coconut: '🥥',
  soup: '🍲',
  bowlspoon: '🥣',
  juicebox: '🧃',
  cupstraw: '🥤',
  glassmilk: '🥛',
  tropicaldrink: '🍹',
  teacup: '🍵',
  hotbev: '☕',
  rice: '🍚',
  watermelon: '🍉',
  melon: '🍈',
  orange: '🍊',
  syringe: '💉',
  testtube: '🧪',
  saltshaker: '🧂',
  lotion: '🧴',
  dash: '💨',
  hospital: '🏥',
  stethoscope: '🩺',
  bandage: '🩹',
  clipboard: '📋',
  alarm: '⏰',

  // Notes module — the pinboard and the vault in it.
  memo: '📝',
  pushpin: '📌',
  notepad: '🗒️',
  key: '🔑',
  lockkey: '🔐',
  unlocked: '🔓',
  label: '🏷️',
  paperclip: '📎',

  // Meal sections.
  cookie: '🍪',
  sunrise: '🌅',
  sun: '☀️',
  ruler: '📏',
  scale: '⚖️',
}

/**
 * Every one of these stays `loading="lazy"`, and that's load-bearing rather
 * than incidental: the sign-in page's ambient props are `hidden sm:block`, and
 * a lazy image inside a `display: none` subtree is never fetched at all. Made
 * eager, a phone would download decoration it will never show.
 */
export default function Icon3D({ name, size = 48, className = '', float = false, alt = '' }) {
  const [failed, setFailed] = useState(false)
  const fallback = ICONS[name]

  if (!fallback) return null

  const decorative = alt === ''
  const wrapper = [
    'inline-block shrink-0 select-none',
    float ? 'animate-float' : '',
    className,
  ].join(' ')

  if (failed) {
    return (
      <span
        className={wrapper}
        style={{
          fontSize: size * 0.86,
          lineHeight: 1,
          filter: 'drop-shadow(0 8px 10px var(--shadow-prop))',
        }}
        role={decorative ? 'presentation' : 'img'}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
      >
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={`/icons/${name}.webp`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={decorative || undefined}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={wrapper}
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(0 10px 14px var(--shadow-prop))',
      }}
    />
  )
}
