/**
 * Regenerates public/icons/ — the 3D icon set Icon3D renders.
 *
 * The artwork is Microsoft's Fluent Emoji (MIT). Upstream ships each icon as a
 * 512px PNG of roughly 31KB; the app draws them between 18px and 110px, so
 * serving the originals meant paying seven times over for pixels nobody sees,
 * from a third-party origin the browser had to open a connection to first.
 * This pulls each one down and re-encodes it as a 256px WebP (~4KB), keyed by
 * the name Icon3D uses rather than by the upstream slug — upstream renames
 * folders (the 🎯 icon moved from 'Direct hit' to 'Bullseye' and silently
 * 404'd for a while), and that shouldn't be able to reach the app.
 *
 * Needs curl and ffmpeg built with libwebp on PATH. Run from the repo root:
 *
 *   node scripts/fetch-icons.mjs
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)

const CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'
const OUT = 'public/icons'
const SIZE = 256
const QUALITY = 82
const CONCURRENCY = 8

// Icon3D's name -> [upstream folder, upstream file slug]
const ICONS = {
  plate: ['Fork and knife with plate', 'fork_and_knife_with_plate'],
  salad: ['Green salad', 'green_salad'],
  avocado: ['Avocado', 'avocado'],
  bread: ['Bread', 'bread'],
  butter: ['Butter', 'butter'],
  meat: ['Poultry leg', 'poultry_leg'],
  fire: ['Fire', 'fire'],
  target: ['Bullseye', 'bullseye'],
  party: ['Party popper', 'party_popper'],
  sparkles: ['Sparkles', 'sparkles'],
  star: ['Glowing star', 'glowing_star'],
  search: ['Magnifying glass tilted left', 'magnifying_glass_tilted_left'],
  cooking: ['Cooking', 'cooking'],
  curry: ['Curry rice', 'curry_rice'],
  gear: ['Gear', 'gear'],
  lock: ['Locked', 'locked'],
  seedling: ['Seedling', 'seedling'],
  chart: ['Chart increasing', 'chart_increasing'],
  bulb: ['Light bulb', 'light_bulb'],
  moon: ['Crescent moon', 'crescent_moon'],
  burger: ['Hamburger', 'hamburger'],
  bus: ['Bus', 'bus'],
  house: ['House', 'house'],
  shopping: ['Shopping bags', 'shopping_bags'],
  clapper: ['Clapper board', 'clapper_board'],
  pill: ['Pill', 'pill'],
  cart: ['Shopping cart', 'shopping_cart'],
  receipt: ['Receipt', 'receipt'],
  coin: ['Coin', 'coin'],
  banknote: ['Dollar banknote', 'dollar_banknote'],
  moneybag: ['Money bag', 'money_bag'],
  moneywings: ['Money with wings', 'money_with_wings'],
  card: ['Credit card', 'credit_card'],
  bank: ['Bank', 'bank'],
  purse: ['Purse', 'purse'],
  gift: ['Wrapped gift', 'wrapped_gift'],
  books: ['Books', 'books'],
  plane: ['Airplane', 'airplane'],
  phone: ['Mobile phone', 'mobile_phone'],
  chartdown: ['Chart decreasing', 'chart_decreasing'],
  droplet: ['Droplet', 'droplet'],
  coconut: ['Coconut', 'coconut'],
  soup: ['Pot of food', 'pot_of_food'],
  bowlspoon: ['Bowl with spoon', 'bowl_with_spoon'],
  juicebox: ['Beverage box', 'beverage_box'],
  cupstraw: ['Cup with straw', 'cup_with_straw'],
  glassmilk: ['Glass of milk', 'glass_of_milk'],
  tropicaldrink: ['Tropical drink', 'tropical_drink'],
  teacup: ['Teacup without handle', 'teacup_without_handle'],
  hotbev: ['Hot beverage', 'hot_beverage'],
  rice: ['Cooked rice', 'cooked_rice'],
  watermelon: ['Watermelon', 'watermelon'],
  melon: ['Melon', 'melon'],
  orange: ['Tangerine', 'tangerine'],
  syringe: ['Syringe', 'syringe'],
  testtube: ['Test tube', 'test_tube'],
  saltshaker: ['Salt', 'salt'],
  lotion: ['Lotion bottle', 'lotion_bottle'],
  dash: ['Dashing away', 'dashing_away'],
  hospital: ['Hospital', 'hospital'],
  stethoscope: ['Stethoscope', 'stethoscope'],
  bandage: ['Adhesive bandage', 'adhesive_bandage'],
  clipboard: ['Clipboard', 'clipboard'],
  alarm: ['Alarm clock', 'alarm_clock'],
  memo: ['Memo', 'memo'],
  pushpin: ['Pushpin', 'pushpin'],
  notepad: ['Spiral notepad', 'spiral_notepad'],
  key: ['Key', 'key'],
  lockkey: ['Locked with key', 'locked_with_key'],
  unlocked: ['Unlocked', 'unlocked'],
  label: ['Label', 'label'],
  paperclip: ['Paperclip', 'paperclip'],
  cookie: ['Cookie', 'cookie'],
  sunrise: ['Sunrise', 'sunrise'],
  sun: ['Sun', 'sun'],
  ruler: ['Straight ruler', 'straight_ruler'],
  scale: ['Balance scale', 'balance_scale'],
}

async function fetchOne(name, [folder, slug], scratch) {
  const url = `${CDN}/${encodeURIComponent(folder)}/3D/${slug}_3d.png`
  const raw = join(scratch, `${name}.png`)
  const out = join(OUT, `${name}.webp`)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await run('curl', ['-sfL', '--max-time', '60', '-o', raw, url])
      // A 404 body or a truncated download would otherwise sail through ffmpeg
      // as a broken file and ship.
      if (statSync(raw).size < 500) throw new Error('download too small to be an icon')
      await run('ffmpeg', [
        '-v', 'error', '-y', '-i', raw,
        '-frames:v', '1', '-update', '1',
        '-vf', `scale=${SIZE}:${SIZE}:flags=lanczos`,
        '-c:v', 'libwebp', '-quality', String(QUALITY), '-pix_fmt', 'yuva420p',
        out,
      ])
      return { name, bytes: statSync(out).size }
    } catch (error) {
      if (attempt === 3) return { name, error: error.message ?? String(error) }
    }
  }
  return { name, error: 'unreachable' }
}

const scratch = mkdtempSync(join(tmpdir(), 'zephr-icons-'))
mkdirSync(OUT, { recursive: true })

const queue = Object.entries(ICONS)
const results = []
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const [name, source] = queue.shift()
      results.push(await fetchOne(name, source, scratch))
    }
  })
)

const failed = results.filter((r) => r.error)
const ok = results.filter((r) => !r.error)
const total = ok.reduce((n, r) => n + r.bytes, 0)

console.log(`${ok.length}/${results.length} icons -> ${OUT} (${(total / 1024).toFixed(0)}KB total)`)
if (failed.length) {
  console.error('failed:')
  for (const entry of failed) console.error(`  ${entry.name}: ${entry.error}`)
  process.exitCode = 1
}
