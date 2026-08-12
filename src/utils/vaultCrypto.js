/**
 * The vault's cryptography — everything the password half of Notes trusts.
 *
 * The rule this file exists to enforce: a password is encrypted in the browser
 * and leaves it as ciphertext, so Supabase stores a blob it cannot read and a
 * leaked database row is worth nothing without the master passphrase. That
 * passphrase is never stored, never sent, and never derivable from anything on
 * the server — which also means it cannot be reset, and the UI says so.
 *
 * Choices, and why:
 *
 *   PBKDF2-HMAC-SHA256, 310,000 iterations — the OWASP figure for PBKDF2 with
 *     SHA-256. Argon2id would be the better primitive, but WebCrypto doesn't
 *     ship it and pulling a WASM implementation in for one screen is a worse
 *     trade than a well-tuned PBKDF2. The count is stored on the vault row
 *     rather than hard-coded here, so it can be raised for new vaults without
 *     stranding the ones already written.
 *   AES-GCM 256 — authenticated. A wrong key doesn't quietly return garbage,
 *     it throws, which is how unlock tells a bad passphrase from a good one.
 *   A fresh 12-byte IV per encryption, prepended to the ciphertext. Reusing a
 *     GCM nonce under one key is the way to break AES-GCM, so it is generated
 *     at every single call and never derived from anything.
 *   One salt per user rather than per note, so unlocking the vault is one
 *     derivation instead of one per row — at 310k iterations, per-note salts
 *     would mean a visible stall to open a board of twenty logins.
 *
 * Nothing here throws a message worth showing a user; callers translate.
 */

/** OWASP's PBKDF2-HMAC-SHA256 floor. Stored per vault — see the note above. */
export const PBKDF2_ITERATIONS = 310_000

/** Encrypted under the derived key to prove a passphrase is the right one. */
const VERIFIER_TOKEN = 'zephr.vault.v1'

const IV_BYTES = 12
const SALT_BYTES = 16

/**
 * WebCrypto's subtle half only exists in a secure context: https, or localhost.
 * Over plain http on a LAN address it is simply absent, and every call below
 * would fail on `undefined`. Checked once so the UI can say why instead of
 * throwing a TypeError at the first keystroke.
 */
export const isVaultSupported =
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.subtle !== 'undefined' &&
  typeof globalThis.crypto.getRandomValues === 'function'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/* ── bytes ⇄ base64 ────────────────────────────────────────────────────────
   Chunked, because `String.fromCharCode(...bytes)` on a long note blows the
   argument limit and takes the whole board down with it. */

function toBase64(bytes) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length))
}

/** A fresh per-user salt, base64. Public by design — it defeats rainbow tables. */
export function newSalt() {
  return toBase64(randomBytes(SALT_BYTES))
}

/**
 * Passphrase → AES-GCM key.
 *
 * Slow on purpose: this is the only thing standing between a stolen database
 * row and a password, and the ~0.3–1s it costs is paid once per unlock.
 */
export async function deriveKey(passphrase, saltB64, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64),
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    // Not extractable: nothing in the app has a reason to read the key back
    // out, and a key that can't be exported can't be accidentally logged.
    false,
    ['encrypt', 'decrypt']
  )
}

/** Plaintext → base64(iv ‖ ciphertext ‖ tag). */
export async function encryptText(key, plaintext) {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  )

  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv, 0)
  packed.set(ciphertext, iv.length)
  return toBase64(packed)
}

/** The inverse. Throws on a wrong key or a tampered blob — GCM checks the tag. */
export async function decryptText(key, blob) {
  const packed = fromBase64(blob)
  const iv = packed.subarray(0, IV_BYTES)
  const ciphertext = packed.subarray(IV_BYTES)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return decoder.decode(plaintext)
}

export async function encryptJSON(key, value) {
  return encryptText(key, JSON.stringify(value))
}

export async function decryptJSON(key, blob) {
  return JSON.parse(await decryptText(key, blob))
}

/**
 * Everything a brand-new vault row needs, plus the unlocked key to go with it.
 *
 * The verifier is a known token under the derived key. It's what lets unlock
 * reject a typo immediately rather than handing back a key that fails later,
 * one note at a time, looking like data corruption.
 */
export async function createVault(passphrase, iterations = PBKDF2_ITERATIONS) {
  const salt = newSalt()
  const key = await deriveKey(passphrase, salt, iterations)
  const verifier = await encryptText(key, VERIFIER_TOKEN)
  return { key, salt, verifier, iterations }
}

/**
 * Check a passphrase against a stored vault row.
 *
 * Returns the key on success and `null` on a wrong passphrase — the caller
 * can't do anything different for the two failure shapes, and treating a
 * failed tag check as an exception makes every call site wrap this in a try.
 */
export async function unlockVault(passphrase, vault) {
  const key = await deriveKey(passphrase, vault.salt, vault.iterations ?? PBKDF2_ITERATIONS)
  try {
    const token = await decryptText(key, vault.verifier)
    return token === VERIFIER_TOKEN ? key : null
  } catch {
    return null
  }
}

/* ── Password generation ───────────────────────────────────────────────── */

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz', // no l
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // no I, O
  digits: '23456789', // no 0, 1
  symbols: '!@#$%^&*-_=+?',
}

/** The confusable characters trimmed above, back in for anyone who wants them. */
const AMBIGUOUS = { lower: 'l', upper: 'IO', digits: '01', symbols: '' }

/**
 * Uniform random index into `max`, by rejection.
 *
 * `getRandomValues() % max` is the obvious version and it is biased: with 256
 * byte values and an alphabet of 62, the first 8 characters come up fractionally
 * more often. Nobody would ever notice, which is exactly why it's worth not
 * doing — this is the one function in the app where "close enough" has a cost.
 */
function randomIndex(max) {
  const limit = Math.floor(256 / max) * max
  const buffer = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0] < limit) return buffer[0] % max
  }
}

function pick(alphabet) {
  return alphabet[randomIndex(alphabet.length)]
}

export const PASSWORD_DEFAULTS = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
}

/**
 * A random password of the requested shape.
 *
 * Guarantees one character from every enabled class — a generated password that
 * happens to contain no digit gets rejected by some sign-up form, and "generate
 * again until it's accepted" is how people end up typing one by hand instead.
 * The guaranteed characters are shuffled in rather than left at the front.
 */
export function generatePassword(options = {}) {
  const config = { ...PASSWORD_DEFAULTS, ...options }
  const length = Math.min(64, Math.max(8, Math.round(config.length) || 20))

  const classes = ['lower', 'upper', 'digits', 'symbols'].filter((name) => config[name])
  // Every class off is a slip in the UI, not a request for an empty password.
  if (classes.length === 0) classes.push('lower', 'digits')

  const alphabets = classes.map((name) =>
    config.avoidAmbiguous ? SETS[name] : SETS[name] + AMBIGUOUS[name]
  )
  const pool = alphabets.join('')

  const chars = alphabets.map((alphabet) => pick(alphabet))
  while (chars.length < length) chars.push(pick(pool))

  // Fisher–Yates, so the guaranteed characters aren't always in positions 0..n.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

/**
 * A memorable passphrase: four words, a separator, a number.
 *
 * Offered beside the random generator because some passwords have to be typed
 * on a television remote, and 20 characters of line noise is not the answer
 * there. The list is short — 96 words, ~6.6 bits each — so this is weaker than
 * the random option at the same length, and `scorePassword` prices it honestly.
 */
const WORDS =
  'amber anchor apple arrow autumn basil beacon birch bishop bramble breeze bronze cabin cactus candle canvas cedar cherry cinder clover cobalt comet copper coral cotton cradle crimson crystal dahlia damson dawn delta ember fable falcon fennel fern flint forest garnet ginger granite harbour hazel heron ink ivory jasmine jetty juniper kernel kettle lantern lattice ledger lichen lilac linen lotus lunar maple marble meadow mica mint mosaic nectar nickel nutmeg oak ochre olive onyx opal orchard pebble pepper pewter pine pollen poppy quartz quince ripple rosemary saffron sage sandal sepia shale silver sorrel spruce sumac thistle thyme timber topaz velvet walnut willow'.split(
    ' '
  )

export function generatePassphrase({ words = 4, separator = '-', number = true } = {}) {
  const count = Math.min(8, Math.max(3, Math.round(words) || 4))
  const chosen = Array.from({ length: count }, () => WORDS[randomIndex(WORDS.length)])
  if (number) chosen.push(String(10 + randomIndex(90)))
  return chosen.join(separator)
}

/* ── Strength ──────────────────────────────────────────────────────────── */

const COMMON = [
  'password', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey',
  'dragon', 'football', 'abc123', '123456', 'zephr',
]

/**
 * A rough strength estimate, in bits, and a label for it.
 *
 * Deliberately rough. A real estimator (zxcvbn and friends) is a 400kB
 * dictionary, and this meter's job is to stop someone saving "hemanth123" — not
 * to be an oracle. It prices the alphabet actually used, then discounts the
 * patterns that make a long password no harder to guess than a short one:
 * repeats, straight runs, and the obvious dictionary words.
 *
 * The bands are chosen against offline-cracking reality rather than flattery:
 * under 40 bits is breakable, and it says so.
 */
export function scorePassword(password) {
  const value = password ?? ''
  if (!value) return { bits: 0, level: 0, label: 'Empty', hint: 'Nothing to save yet.' }

  let alphabet = 0
  if (/[a-z]/.test(value)) alphabet += 26
  if (/[A-Z]/.test(value)) alphabet += 26
  if (/[0-9]/.test(value)) alphabet += 10
  if (/[^A-Za-z0-9]/.test(value)) alphabet += 32

  let bits = value.length * Math.log2(Math.max(alphabet, 2))

  // Long repeats of one character add length without adding guesses.
  const runs = value.match(/(.)\1{2,}/g)
  if (runs) bits -= runs.reduce((sum, run) => sum + (run.length - 1) * 3, 0)

  // 'abcd', '1234' and their reverses — a sequence is one guess, not four.
  let sequential = 0
  for (let i = 2; i < value.length; i += 1) {
    const a = value.charCodeAt(i - 2)
    const b = value.charCodeAt(i - 1)
    const c = value.charCodeAt(i)
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) sequential += 1
  }
  bits -= sequential * 3

  const lowered = value.toLowerCase()
  const hit = COMMON.find((word) => lowered.includes(word))
  if (hit) bits -= Math.min(28, hit.length * 4)

  bits = Math.max(0, Math.round(bits))

  const [level, label, hint] = hit
    ? [0, 'Guessable', `“${hit}” is on every cracking list there is.`]
    : bits < 40
      ? [0, 'Weak', 'Short enough to brute-force offline. Make it longer.']
      : bits < 60
        ? [1, 'Fair', 'Fine for a forum. Not for anything with money in it.']
        : bits < 80
          ? [2, 'Strong', 'Good. Nothing guesses this in a hurry.']
          : [3, 'Excellent', 'Well past anything worth attacking.']

  return { bits, level, label, hint }
}
