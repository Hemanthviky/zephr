/**
 * The avatar catalogue.
 *
 * Drawn rather than fetched: every face here is a handful of SVG shapes in the
 * app's own palette, so an avatar costs no network request, survives offline,
 * can't 404, and never arrives in colours that fight the cream. One
 * parameterised face does the work — a style picks the hair, a couple of flags
 * add the glasses or the beard — which is what keeps fourteen options to one
 * drawing routine instead of fourteen pasted SVG files.
 *
 * Everything is stroked in ink at a constant weight and sits on a flat tile,
 * matching the thick-outline treatment the rest of the app uses.
 */

const INK = '#1B1915'

// Skin tones. Warm across the range — a cool grey face on a cream page reads
// as a rendering bug rather than a choice.
const SKIN = {
  light: '#FBDCBB',
  tan: '#E8B183',
  warm: '#C98B58',
  deep: '#96603A',
  dark: '#6E4327',
}

const HAIR = {
  ink: '#2B2620',
  brown: '#5C3A21',
  auburn: '#8C3B1E',
  blonde: '#E3A93C',
  grey: '#BDB4A2',
}

// Shoulders. Straight from tailwind.config.js so a face never introduces a
// sixth accent colour to the app.
const WEAR = {
  lime: '#C6F32B',
  coral: '#FF9E85',
  tangerine: '#FFCB6B',
  avocado: '#6FD9C2',
  cream: '#F7EDD8',
  ink: '#403A31',
}

// Tile backgrounds, the same five the monogram picks from.
const TILE = {
  lime: '#E6FF94',
  coral: '#FFE4DC',
  tangerine: '#FFEFCE',
  avocado: '#D6F5EC',
  cream: '#F7EDD8',
}

/**
 * The catalogue itself. `sex` marks the two that a stated sex falls back to;
 * everything else is chosen by hand and available to everyone.
 */
export const AVATARS = [
  { id: 'guy', label: 'Guy', sex: 'male', style: 'short', skin: SKIN.tan, hair: HAIR.ink, wear: WEAR.lime, bg: TILE.lime },
  { id: 'girl', label: 'Girl', sex: 'female', style: 'long', skin: SKIN.tan, hair: HAIR.ink, wear: WEAR.coral, bg: TILE.coral },
  { id: 'buzz', label: 'Buzz', style: 'buzz', skin: SKIN.deep, hair: HAIR.ink, wear: WEAR.avocado, bg: TILE.avocado },
  { id: 'beard', label: 'Beard', style: 'short', beard: true, skin: SKIN.light, hair: HAIR.brown, wear: WEAR.tangerine, bg: TILE.tangerine },
  { id: 'bun', label: 'Top knot', style: 'bun', skin: SKIN.light, hair: HAIR.auburn, wear: WEAR.avocado, bg: TILE.cream },
  { id: 'curls', label: 'Curls', style: 'curls', skin: SKIN.warm, hair: HAIR.ink, wear: WEAR.coral, bg: TILE.lime },
  { id: 'bob', label: 'Bob', style: 'bob', skin: SKIN.light, hair: HAIR.blonde, wear: WEAR.avocado, bg: TILE.avocado },
  { id: 'specs', label: 'Specs', style: 'short', glasses: true, skin: SKIN.warm, hair: HAIR.ink, wear: WEAR.cream, bg: TILE.tangerine },
  { id: 'reader', label: 'Reader', style: 'long', glasses: true, skin: SKIN.light, hair: HAIR.brown, wear: WEAR.lime, bg: TILE.cream },
  { id: 'shades', label: 'Shades', style: 'short', shades: true, skin: SKIN.dark, hair: HAIR.ink, wear: WEAR.tangerine, bg: TILE.coral },
  { id: 'cap', label: 'Cap', style: 'cap', skin: SKIN.tan, hair: HAIR.ink, wear: WEAR.ink, bg: TILE.avocado },
  { id: 'hijab', label: 'Hijab', style: 'hijab', skin: SKIN.warm, hair: HAIR.ink, wear: WEAR.cream, bg: TILE.tangerine },
  { id: 'turban', label: 'Turban', style: 'turban', skin: SKIN.warm, hair: HAIR.ink, wear: WEAR.cream, bg: TILE.lime },
  { id: 'silver', label: 'Silver', style: 'bob', skin: SKIN.light, hair: HAIR.grey, wear: WEAR.coral, bg: TILE.cream },
]

const BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]))

/** The monogram, kept as a first-class option rather than only a fallback. */
export const INITIALS_ID = 'initials'

/** What someone gets before they've picked: their sex's face, else initials. */
export function defaultAvatarId(sex) {
  return AVATARS.find((a) => a.sex && a.sex === sex)?.id ?? INITIALS_ID
}

export function avatarById(id) {
  return BY_ID[id] ?? null
}

/**
 * One face, sized to fill whatever box it's dropped into.
 *
 * Drawn in a 100×100 viewBox with `slice`, so the square artwork fills a circle
 * without letterboxing — the corners are meant to be clipped by the round frame.
 */
export function AvatarArt({ id, className = '' }) {
  const spec = avatarById(id)
  if (!spec) return null

  const { skin, hair, wear, bg, style } = spec
  const covered = style === 'hijab' // headscarf: no ears, no hairline

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      aria-hidden="true"
    >
      <rect width="100" height="100" fill={bg} />

      {/* Neck, then shoulders on top of it — the join should never show. */}
      <rect x="42" y="58" width="16" height="20" fill={skin} stroke={INK} strokeWidth="2.5" />
      <path
        d="M14 100 C14 82 30 74 50 74 C70 74 86 82 86 100 Z"
        fill={wear}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {!covered && (
        <>
          <ellipse cx="26" cy="48" rx="4.5" ry="5.5" fill={skin} stroke={INK} strokeWidth="2.5" />
          <ellipse cx="74" cy="48" rx="4.5" ry="5.5" fill={skin} stroke={INK} strokeWidth="2.5" />
        </>
      )}

      {style === 'hijab' && (
        <path
          d="M50 15 C69 15 80 30 80 48 C80 66 72 78 72 78 L28 78 C28 78 20 66 20 48 C20 30 31 15 50 15 Z"
          fill={wear === WEAR.cream ? '#FFCB6B' : wear}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}

      {/* Head. Everything else is positioned against this ellipse. */}
      <ellipse cx="50" cy="46" rx="23" ry="25" fill={skin} stroke={INK} strokeWidth="3" />

      <Hair style={style} hair={hair} wear={wear} />

      {spec.beard && (
        <path
          d="M29 46 C29 72 39 79 50 79 C61 79 71 72 71 46 C68 62 61 68 50 68 C39 68 32 62 29 46 Z"
          fill={hair}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}

      {/* Face. Drawn after the beard so the mouth stays readable on top of it. */}
      {spec.shades ? (
        <g>
          <path d="M30 44 L70 44" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <rect x="31" y="41" width="16" height="12" rx="4" fill={INK} />
          <rect x="53" y="41" width="16" height="12" rx="4" fill={INK} />
          <path d="M47 45 L53 45" stroke={INK} strokeWidth="3" />
        </g>
      ) : (
        <>
          <circle cx="41" cy="45" r="3.2" fill={INK} />
          <circle cx="59" cy="45" r="3.2" fill={INK} />
          {spec.glasses && (
            <g fill="none" stroke={INK} strokeWidth="2.5">
              <rect x="31.5" y="38.5" width="17" height="13" rx="5" />
              <rect x="51.5" y="38.5" width="17" height="13" rx="5" />
              <path d="M48.5 45 L51.5 45" />
              <path d="M31.5 44 L26 46" />
              <path d="M68.5 44 L74 46" />
            </g>
          )}
        </>
      )}

      <path
        d="M43 57 Q50 64 57 57"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Hair, by style. Each shape is drawn over the top of the head ellipse, so they
 * all start from roughly the same hairline and only differ in what they add.
 */
function Hair({ style, hair, wear }) {
  const stroke = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }

  switch (style) {
    case 'buzz':
      return (
        <path
          d="M27 44 C27 27 73 27 73 44 C71 36 62 32 50 32 C38 32 29 36 27 44 Z"
          fill={hair}
          {...stroke}
        />
      )

    case 'short':
      return (
        <path
          d="M26 47 C24 24 76 24 74 47 C72 35 63 30 50 30 C37 30 28 35 26 47 Z"
          fill={hair}
          {...stroke}
        />
      )

    case 'long':
      return (
        <g fill={hair} {...stroke}>
          {/* Side fall first, so the crown overlaps its top edge. */}
          <path d="M27 44 L27 78 C27 81 34 81 34 78 L34 48 C40 43 60 43 66 48 L66 78 C66 81 73 81 73 78 L73 44 Z" />
          <path d="M26 48 C22 22 78 22 74 48 C71 34 63 29 50 29 C37 29 29 34 26 48 Z" />
        </g>
      )

    case 'bob':
      return (
        <g fill={hair} {...stroke}>
          <path d="M27 44 L27 62 C27 65 34 65 34 62 L34 48 C40 43 60 43 66 48 L66 62 C66 65 73 65 73 62 L73 44 Z" />
          <path d="M26 48 C22 23 78 23 74 48 C71 34 63 29 50 29 C37 29 29 34 26 48 Z" />
        </g>
      )

    case 'bun':
      return (
        <g fill={hair} {...stroke}>
          <circle cx="50" cy="17" r="9" />
          <path d="M26 47 C24 24 76 24 74 47 C72 35 63 30 50 30 C37 30 28 35 26 47 Z" />
        </g>
      )

    case 'curls':
      return (
        <g fill={hair} {...stroke}>
          <circle cx="31" cy="35" r="9" />
          <circle cx="43" cy="27" r="10" />
          <circle cx="57" cy="27" r="10" />
          <circle cx="69" cy="35" r="9" />
          <path d="M27 44 C27 30 73 30 73 44 C71 36 62 32 50 32 C38 32 29 36 27 44 Z" />
        </g>
      )

    case 'cap':
      return (
        <g {...stroke}>
          <path d="M27 44 C27 27 73 27 73 44 Z" fill={hair} />
          <path
            d="M25 43 C25 22 75 22 75 43 C63 39 37 39 25 43 Z"
            fill={wear === WEAR.ink ? '#403A31' : wear}
          />
          <path
            d="M25 40 L18 40 C14 40 13 47 18 47 L30 47 Z"
            fill={wear === WEAR.ink ? '#403A31' : wear}
          />
          <circle cx="50" cy="21" r="3" fill={wear === WEAR.ink ? '#403A31' : wear} />
        </g>
      )

    case 'turban':
      return (
        <g {...stroke}>
          <path
            d="M24 44 C24 22 76 22 76 44 C76 38 70 34 50 34 C30 34 24 38 24 44 Z"
            fill="#FFCB6B"
          />
          <path d="M28 36 C38 30 62 30 72 36" fill="none" stroke={INK} strokeWidth="2" />
          <path d="M31 30 C40 25 60 25 69 30" fill="none" stroke={INK} strokeWidth="2" />
        </g>
      )

    case 'hijab':
      // The scarf is drawn behind the head; the hairline is covered by design.
      return null

    default:
      return null
  }
}
