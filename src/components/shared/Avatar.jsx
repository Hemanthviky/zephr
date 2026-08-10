/**
 * Monogram avatar.
 *
 * No uploads, no gravatar, no stock silhouette — just initials on a tile, which
 * is the one avatar that's always available, always on-palette, and never a
 * broken image. The colour is picked deterministically from the name so it's
 * stable across sessions and devices without storing anything.
 */

// Only hues that already exist in tailwind.config.js. Text is always ink, so
// every one of these has to stay light enough to read against.
const TILES = [
  { bg: '#C6F32B', edge: '#657F04' }, // lime
  { bg: '#FF9E85', edge: '#B32E13' }, // coral
  { bg: '#FFCB6B', edge: '#E08600' }, // tangerine
  { bg: '#6FD9C2', edge: '#0C8F7B' }, // avocado
  { bg: '#E6FF94', edge: '#8CB300' }, // pale lime
]

export function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function tileFor(name = '') {
  // Sum of char codes — crude, but stable, which is the only property that matters.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % 997
  return TILES[hash % TILES.length]
}

export default function Avatar({ name = '', size = 48, className = '', flat = false }) {
  const tile = tileFor(name)
  const initials = initialsOf(name)

  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center border-2 border-ink-900 font-display font-extrabold leading-none tracking-tight text-ink-900 ${className}`}
      style={{
        width: size,
        height: size,
        background: tile.bg,
        borderRadius: size * 0.32,
        fontSize: size * (initials.length > 1 ? 0.36 : 0.44),
        boxShadow: flat ? 'none' : `0 ${Math.max(2, size * 0.07)}px 0 0 ${tile.edge}`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
