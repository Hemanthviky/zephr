/**
 * Starter categories, seeded once on a user's first visit to the Money tab.
 *
 * `icon` is a key into the Icon3D registry (components/shared/Icon3D.jsx) and
 * `color` is a hex lifted straight from tailwind.config.js — the Money module
 * deliberately introduces no new accent colours, so a spending donut and a
 * macro bar are visibly the same design system.
 */

// Palette echo: coral / tangerine / avocado / lime, each at two weights, plus
// warm ink for the catch-all. Nine categories, nine distinguishable hues.
export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'burger', color: '#FF5A38' }, // coral-500
  { name: 'Transport', icon: 'bus', color: '#FFA51F' }, // tangerine-500
  { name: 'Rent & Housing', icon: 'house', color: '#12B39A' }, // avocado-500
  { name: 'Shopping', icon: 'shopping', color: '#AEDC0B' }, // lime-500
  { name: 'Bills & Utilities', icon: 'bulb', color: '#FF9E85' }, // coral-300
  { name: 'Entertainment', icon: 'clapper', color: '#FFCB6B' }, // tangerine-300
  { name: 'Health', icon: 'pill', color: '#6FD9C2' }, // avocado-300
  { name: 'Groceries', icon: 'cart', color: '#8CB300' }, // lime-600
  { name: 'Other', icon: 'receipt', color: '#948B7B' }, // ink-400
]

/** Wallets seeded alongside them. The first is the default on new entries. */
export const DEFAULT_WALLETS = ['Cash', 'Bank', 'Card']

/** Icon choices offered when someone adds a category of their own. */
export const CATEGORY_ICON_CHOICES = [
  'burger', 'cart', 'bus', 'house', 'shopping', 'bulb',
  'clapper', 'pill', 'books', 'plane', 'phone', 'gift',
  'coin', 'card', 'receipt', 'moneybag', 'seedling', 'star',
]

/** Same nine hues, offered as swatches — no colour picker, no off-palette hex. */
export const CATEGORY_COLOR_CHOICES = [
  '#FF5A38', '#FFA51F', '#12B39A', '#AEDC0B', '#FF9E85',
  '#FFCB6B', '#6FD9C2', '#8CB300', '#948B7B',
]

/** Wallet name → Icon3D key, for the wallet chips. Falls back to a coin. */
export function walletIcon(name = '') {
  const key = name.trim().toLowerCase()
  if (key.includes('cash')) return 'banknote'
  if (key.includes('bank')) return 'bank'
  if (key.includes('card') || key.includes('credit')) return 'card'
  if (key.includes('upi') || key.includes('wallet') || key.includes('pay')) return 'phone'
  if (key.includes('saving')) return 'moneybag'
  return 'coin'
}

/** Colour for a category that was deleted or never set. */
export const UNCATEGORISED = { name: 'Uncategorised', icon: 'receipt', color: '#BDB4A2' }
