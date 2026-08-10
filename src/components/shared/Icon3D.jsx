import { useState } from 'react'

/**
 * 3D icon.
 *
 * Renders a Fluent Emoji 3D asset (Microsoft, MIT-licensed) from jsDelivr for
 * the app's key visual moments — empty states, the add button, macro headers,
 * goal celebrations. If the CDN is blocked or offline, it falls back to the
 * platform's own colour emoji glyph, which is the same artwork family, so the
 * layout never collapses into a broken-image box.
 *
 * Small inline UI chrome (chevrons, trash, close) uses lucide-react instead —
 * a 3D render of a chevron would be absurd.
 */

const CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

// [folder name, file slug, unicode fallback]
const ICONS = {
  plate: ['Fork and knife with plate', 'fork_and_knife_with_plate', '🍽️'],
  salad: ['Green salad', 'green_salad', '🥗'],
  avocado: ['Avocado', 'avocado', '🥑'],
  bread: ['Bread', 'bread', '🍞'],
  butter: ['Butter', 'butter', '🧈'],
  meat: ['Poultry leg', 'poultry_leg', '🍗'],
  fire: ['Fire', 'fire', '🔥'],
  target: ['Direct hit', 'direct_hit', '🎯'],
  party: ['Party popper', 'party_popper', '🎉'],
  sparkles: ['Sparkles', 'sparkles', '✨'],
  star: ['Glowing star', 'glowing_star', '🌟'],
  search: ['Magnifying glass tilted left', 'magnifying_glass_tilted_left', '🔍'],
  cooking: ['Cooking', 'cooking', '🍳'],
  curry: ['Curry rice', 'curry_rice', '🍛'],
  gear: ['Gear', 'gear', '⚙️'],
  lock: ['Locked', 'locked', '🔒'],
  seedling: ['Seedling', 'seedling', '🌱'],
  chart: ['Chart increasing', 'chart_increasing', '📈'],
  bulb: ['Light bulb', 'light_bulb', '💡'],
  moon: ['Crescent moon', 'crescent_moon', '🌙'],

  // Money module — expense categories, wallets and empty states.
  burger: ['Hamburger', 'hamburger', '🍔'],
  bus: ['Bus', 'bus', '🚌'],
  house: ['House', 'house', '🏠'],
  shopping: ['Shopping bags', 'shopping_bags', '🛍️'],
  clapper: ['Clapper board', 'clapper_board', '🎬'],
  pill: ['Pill', 'pill', '💊'],
  cart: ['Shopping cart', 'shopping_cart', '🛒'],
  receipt: ['Receipt', 'receipt', '🧾'],
  coin: ['Coin', 'coin', '🪙'],
  banknote: ['Dollar banknote', 'dollar_banknote', '💵'],
  moneybag: ['Money bag', 'money_bag', '💰'],
  moneywings: ['Money with wings', 'money_with_wings', '💸'],
  card: ['Credit card', 'credit_card', '💳'],
  bank: ['Bank', 'bank', '🏦'],
  purse: ['Purse', 'purse', '👛'],
  gift: ['Wrapped gift', 'wrapped_gift', '🎁'],
  books: ['Books', 'books', '📚'],
  plane: ['Airplane', 'airplane', '✈️'],
  phone: ['Mobile phone', 'mobile_phone', '📱'],
  chartdown: ['Chart decreasing', 'chart_decreasing', '📉'],
}

const srcFor = (name) => {
  const icon = ICONS[name]
  if (!icon) return null
  return `${CDN}/${encodeURIComponent(icon[0])}/3D/${icon[1]}_3d.png`
}

export default function Icon3D({ name, size = 48, className = '', float = false, alt = '' }) {
  const [failed, setFailed] = useState(false)
  const icon = ICONS[name]

  if (!icon) return null

  const [, , fallback] = icon
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
          filter: 'drop-shadow(0 8px 10px rgba(122,84,25,0.35))',
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
      src={srcFor(name)}
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
        filter: 'drop-shadow(0 10px 14px rgba(122,84,25,0.32))',
      }}
    />
  )
}
