/**
 * The avatar, everywhere it appears.
 *
 * Built on the neobrutalism registry avatar (`@/components/ui/avatar`, wrapping
 * Base UI) so image loading, fallback swapping and the badge/group slots come
 * from the primitive rather than being hand-rolled here.
 *
 * What someone sees, in order:
 *   1. the face they picked, if they picked one (`user_metadata.avatar_id`);
 *   2. the default for their sex, if they've told us one in body stats;
 *   3. their initials on a tile — always available, always on-palette, never a
 *      broken image, and the only option that needs nothing stored anywhere.
 *
 * Steps 1 and 2 arrive through context rather than props: the avatar is drawn
 * in five different module headers that have no other reason to know about
 * profile preferences, and threading two values through all of them to reach a
 * 40px circle isn't a trade worth making. An explicit `avatarId` prop still
 * wins, which is what the picker uses to draw options that aren't the current one.
 */

import { createContext, useContext, useMemo } from 'react'
import {
  Avatar as AvatarRoot,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { AvatarArt, INITIALS_ID, defaultAvatarId, avatarById } from './avatarArt'

// Only hues that already exist in tailwind.config.js. Text is always ink, so
// every one of these has to stay light enough to read against.
const TILES = [
  { bg: '#C6F32B', edge: '#657F04' }, // lime
  { bg: '#FF9E85', edge: '#B32E13' }, // coral
  { bg: '#FFCB6B', edge: '#E08600' }, // tangerine
  { bg: '#6FD9C2', edge: '#0C8F7B' }, // avocado
  { bg: '#E6FF94', edge: '#8CB300' }, // pale lime
]

const AvatarPrefContext = createContext({ avatarId: null, sex: null })

/** Wraps the signed-in app so every avatar resolves the same preference. */
export function AvatarPrefProvider({ avatarId, sex, children }) {
  const value = useMemo(() => ({ avatarId: avatarId ?? null, sex: sex ?? null }), [avatarId, sex])
  return <AvatarPrefContext.Provider value={value}>{children}</AvatarPrefContext.Provider>
}

export function useAvatarPref() {
  return useContext(AvatarPrefContext)
}

/** Where a user's avatar choice lives — same metadata bag as their name. */
export function avatarIdOf(user) {
  return user?.user_metadata?.avatar_id ?? null
}

export function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function tileFor(name = '') {
  // Sum of char codes — crude, but stable across sessions and devices, which is
  // the only property that matters.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % 997
  return TILES[hash % TILES.length]
}

export default function Avatar({
  name = '',
  size = 48,
  className = '',
  flat = false,
  avatarId,
  sex,
  src,
}) {
  const pref = useAvatarPref()
  const chosen = avatarId ?? pref.avatarId ?? defaultAvatarId(sex ?? pref.sex)
  const art = chosen === INITIALS_ID ? null : avatarById(chosen)

  const tile = tileFor(name)
  const initials = initialsOf(name)
  // The hard bottom edge is tinted to the face's own tile so it reads as one
  // object rather than a sticker with a shadow borrowed from somewhere else.
  const edge = art ? shadeOf(art.bg) : tile.edge

  return (
    <AvatarRoot
      // The primitive sizes itself in fixed steps (size-6/8/10); callers here
      // pass a pixel size, so inline width/height overrides those.
      style={{
        width: size,
        height: size,
        boxShadow: flat ? 'none' : `0 ${Math.max(2, size * 0.07)}px 0 0 ${edge}`,
      }}
      // `on-light`: the tile behind a face is a fixed accent in both themes, so
      // the outline and the initials on it have to stay dark after sunset
      // rather than following the page.
      className={`on-light overflow-hidden border-ink-900 ${className}`}
      aria-hidden={src ? undefined : 'true'}
    >
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback
        className="overflow-hidden font-display font-extrabold leading-none tracking-tight text-ink-900"
        style={
          art
            ? { background: art.bg, padding: 0 }
            : {
                background: tile.bg,
                fontSize: size * (initials.length > 1 ? 0.36 : 0.44),
              }
        }
      >
        {art ? <AvatarArt id={chosen} /> : initials}
      </AvatarFallback>
    </AvatarRoot>
  )
}

/** A darker sibling of a tile colour, for the pressed-edge shadow. */
function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (channel) => Math.round(channel * 0.62)
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}
