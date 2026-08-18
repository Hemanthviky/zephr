/**
 * Turns the south_indian_foods_nutrition.csv dump into src/data/southIndianFoods.js.
 *
 * The CSV cannot be dropped in as-is — four things are wrong with it from the
 * app's point of view, and this script is the record of how each was handled:
 *
 *   1. Its numbers are PER SERVING, the app's are PER 100 G. Coconut Oil is
 *      listed as 90 kcal at a 10 g serving; pasted unconverted it would read as
 *      a 90 kcal/100g oil. Every row is rescaled by 100/serving.
 *   2. No sugar and no sodium columns. Those stay `null` — see the note in
 *      src/data/southIndianFoods.js. We do not invent them.
 *   3. Its names are a different house style ("Masala Dosa", "Egg (Boiled)")
 *      and ~40 of them already exist in the hand-checked core database.
 *      Normalising the names to sentence case with the qualifier in front
 *      ("Boiled egg") makes most duplicates collide on slug and drop out.
 *   4. No emoji, which every row in the app needs. Assigned by keyword.
 *
 * Re-run after editing the CSV:  node scripts/import-south-indian.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FOODS } from '../src/data/foodDatabase.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = process.argv[2] || path.join(HERE, 'data', 'south_indian_foods_nutrition.csv')
const OUT_PATH = path.join(HERE, '..', 'src', 'data', 'southIndianFoods.js')

// ── CSV ────────────────────────────────────────────────────────────────────
// Four food names carry a comma inside their parentheses ("Fish (Sardine,
// Cooked)"), so the quoted-field case has to be handled properly.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim()))
  const keys = header.map((h) => h.replace(/^﻿/, '').trim())
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])))
}

// ── Category mapping ───────────────────────────────────────────────────────
// The CSV's 23 categories collapse onto the app's. 'curry', 'condiment' and
// 'sweet' are new — 561 curries and 102 chutneys/podis/pickles are far too many
// to bury under the existing catch-all 'indian' label, and the category label
// is part of what search matches against.
const CATEGORY_MAP = {
  Curry: 'curry',
  Soup: 'curry',
  Breakfast: 'indian',
  'Rice Dish': 'indian',
  Staple: 'grain',
  'Grain/Millet': 'grain',
  Snack: 'snack',
  Sweet: 'sweet',
  Dessert: 'sweet',
  Sweetener: 'sweet',
  Condiment: 'condiment',
  'Spice/Condiment': 'condiment',
  Vegetable: 'veg',
  Fruit: 'fruit',
  Beverage: 'drink',
  Pulse: 'protein',
  'Pulse/Legume': 'protein',
  Protein: 'protein',
  'Nuts/Seeds': 'protein',
  Nuts: 'protein',
  'Nuts/Fruit': 'protein',
  Dairy: 'dairy',
  'Fat/Oil': 'dairy',
}

// ── Name normalisation ─────────────────────────────────────────────────────
// Every name in the CSV carries its qualifier in brackets, and what to do with
// it depends entirely on what the bracket means:
//
//   "Egg (Boiled)"          how it was cooked  → move in front: "Boiled egg"
//   "Fish (Mackerel) Curry" which fish it is   → move in front: "Mackerel fish curry"
//   "Brinjal (Eggplant)"    another name for it → alias, so both queries find it
//   "Toor Dal Adai (mix)"   says nothing        → drop
//
// The default is to move it in front, because that can only ever keep two rows
// apart. Aliasing is the risky direction: it silently merged all thirty
// Mackerel/Pomfret/Seer dishes into ten when this list was the other way round.
const ALIAS_TERMS = new Set([
  'puliyodarai', 'medu vada', 'ven pongal', 'sakkarai pongal', 'plain yogurt',
  'kerala style', 'south style', 'namkeen', 'flattened rice', 'chickpea',
  'black chana', 'kala chana', 'kabuli chana', 'kidney beans', 'eggplant',
  "lady's finger", 'moringa pods', 'elephant foot', 'taro', 'tindora', 'palak',
  'brinjal', 'button', 'sesame', 'amla', 'indian gooseberry', 'chikoo',
  'mosambi', 'java plum', 'atta', 'dalia', 'murmura', 'rava', 'sooji',
  'godhuma', 'paal payasam', 'hing', 'nannari', 'pearl millet gruel',
  'chutney powder',
])

// Bracketed noise: true of the row either way, so it earns no name and no alias.
const DROP_TERMS = new Set(['mix', 'powder', 'as drink'])

// Cooking method leads the name ("Cooked sardine fish", not "Sardine cooked
// fish") to match the core database's "Grilled chicken breast" / "Boiled potato".
const QUALIFIER_PREFIX = new Set([
  'cooked', 'boiled', 'fried', 'roasted', 'steamed', 'raw', 'ripe', 'fresh',
  'plain', 'whole', 'spiced', 'dry',
])

const PROPER_NOUNS = new Set([
  'chettinad', 'mysore', 'kerala', 'andhra', 'tamil', 'malabar', 'udupi',
  'hyderabadi', 'mangalorean', 'karnataka', 'palakkad', 'kongunadu', 'coorg',
  'nendran', 'kabuli', 'kala', 'poovan', 'french', 'bisi', 'nannari',
])

const sentenceCase = (words) =>
  words
    .map((word, i) => {
      const lower = word.toLowerCase()
      if (i === 0) return word[0].toUpperCase() + word.slice(1).toLowerCase()
      return PROPER_NOUNS.has(lower) ? word[0].toUpperCase() + lower.slice(1) : lower
    })
    .join(' ')

function normaliseName(rawName) {
  const aliases = new Set()
  let name = rawName.trim()

  // "Idli (2 pcs)" — a portion count, not part of the name. `serving` says it.
  name = name.replace(/\s*\(\s*\d+\s*(pcs?|pieces?|nos?)\s*\)/gi, '')

  const methods = []
  const varieties = []
  name = name.replace(/\s*\(([^)]+)\)/g, (_, inner) => {
    for (const part of inner.split(/[,/]/)) {
      const term = part.trim().toLowerCase()
      if (!term || DROP_TERMS.has(term)) continue
      if (QUALIFIER_PREFIX.has(term)) methods.push(term)
      else if (ALIAS_TERMS.has(term)) aliases.add(term)
      else varieties.push(term)
    }
    return ' '
  })

  // "Obbattu / Puran Poli" — two names for one dish; keep the first, alias the rest.
  const [primary, ...alternates] = name.split('/').map((part) => part.trim()).filter(Boolean)
  for (const alt of alternates) aliases.add(alt.toLowerCase())

  const words = [...methods, ...varieties, ...primary.trim().split(/\s+/)].filter(Boolean)
  const display = sentenceCase(words)

  // An alias identical to the name it hangs off is noise in the search index.
  aliases.delete(display.toLowerCase())
  return { name: display, aliases: [...aliases] }
}

// ── Emoji ──────────────────────────────────────────────────────────────────
// First match wins, so the list is ordered most-specific first. The animal
// protein in a dish is more useful at a glance than the dish form, so those
// come before the "…is a curry" rules.
// Whole words only. Without the group the alternation binds looser than the
// word boundaries — /\bcoffee|tea|chai\b/ finds "tea" inside "steamed", and
// "White steamed rice" comes out as a cup of coffee.
const anyOf = (...terms) => new RegExp(`\\b(${terms.join('|')})\\b`, 'i')

const EMOJI_RULES = [
  [anyOf('prawn', 'prawns', 'shrimp', 'jhinga', 'eral'), '🍤'],
  [anyOf('crab', 'nandu'), '🦀'],
  [anyOf('squid', 'calamari', 'kanava'), '🦑'],
  [anyOf('fish', 'meen', 'mackerel', 'pomfret', 'seer', 'sardine', 'tuna', 'anchovy', 'tilapia'), '🐟'],
  [anyOf('chicken', 'kozhi'), '🍗'],
  [anyOf('mutton', 'lamb', 'goat', 'keema'), '🍖'],
  [anyOf('egg', 'anda', 'muttai', 'omelette'), '🥚'],
  [anyOf('coffee', 'tea', 'chai'), '☕'],
  [anyOf('juice', 'sherbet', 'milkshake', 'lassi', 'water'), '🥤'],
  [anyOf('milk', 'basundi'), '🥛'],
  [anyOf('ghee', 'oil', 'butter'), '🧈'],
  [anyOf('pickle', 'thokku'), '🫙'],
  [anyOf('chutney', 'pachadi', 'thogayal', 'thuvaiyal', 'raita'), '🥣'],
  [anyOf('idli'), '⚪'],
  [anyOf('dosa', 'uttapam', 'adai', 'appam', 'pesarattu', 'pancake'), '🥞'],
  [anyOf('vada', 'vadai', 'bonda', 'pakoda', 'bajji', 'punugulu'), '🍩'],
  [anyOf('roti', 'paratha', 'chapati', 'puttu', 'poori', 'puri', 'kulcha', 'naan'), '🫓'],
  [anyOf('podi', 'powder', 'masala podi', 'salt'), '🧂'],
  [anyOf('payasam', 'kheer', 'halwa', 'kesari', 'laddu', 'ladoo', 'burfi', 'barfi',
    'pak', 'jamun', 'holige', 'obbattu', 'poli', 'sweet', 'jalebi', 'kozhukattai',
    'modak', 'appam sweet', 'mysore pak'), '🍮'],
  [anyOf('chips', 'murukku', 'mixture', 'appalam', 'papad', 'seedai', 'thattai',
    'ribbon', 'sev', 'boondi'), '🍘'],
  [anyOf('rice', 'biryani', 'pulao', 'bath', 'sadam', 'pongal', 'khichdi',
    'puliyodarai', 'upma', 'sevai', 'idiyappam'), '🍚'],
  [anyOf('kuzhambu', 'sambar', 'rasam', 'kootu', 'kurma', 'korma', 'theeyal',
    'erissery', 'stew', 'gravy', 'curry', 'masiyal', 'kadhi', 'kuruma', 'mor kuzhambu'), '🍛'],
  [anyOf('poriyal', 'thoran', 'mezhukkupuratti', 'podimas', 'vepudu', 'sabzi',
    'fry', 'roast', 'upperi', 'varuval', 'sukka', 'chettinad'), '🥘'],
  [anyOf('dal', 'paruppu', 'lentil', 'lentils', 'chana', 'rajma', 'gram',
    'sprouts', 'soy', 'sundal'), '🫘'],
  [anyOf('nut', 'nuts', 'cashew', 'almond', 'almonds', 'peanut', 'groundnut',
    'seed', 'seeds', 'pista'), '🥜'],
  [anyOf('coconut'), '🥥'],
  [anyOf('curd', 'yogurt', 'paneer', 'cheese'), '🧀'],
  [anyOf('banana', 'plantain', 'nendran', 'poovan'), '🍌'],
  [anyOf('mango', 'jackfruit', 'papaya', 'sapota', 'chikoo'), '🥭'],
  [anyOf('jaggery', 'honey', 'sugar'), '🍯'],
  [anyOf('millet', 'ragi', 'jowar', 'bajra', 'rava', 'semolina', 'flour',
    'atta', 'wheat', 'oats', 'sorghum'), '🌾'],
]

// Produce and greens read better as themselves than as whatever dish word
// happens to appear in the name — "French beans" is a vegetable, not a pulse.
const PRODUCE_RULES = [
  [anyOf('banana', 'plantain', 'nendran', 'poovan'), '🍌'],
  [anyOf('mango'), '🥭'],
  [anyOf('jackfruit', 'papaya', 'sapota', 'chikoo', 'custard apple'), '🥭'],
  [anyOf('jamun', 'grapes', 'java plum'), '🍇'],
  [anyOf('guava', 'amla', 'gooseberry'), '🍏'],
  [anyOf('gourd', 'pumpkin', 'brinjal', 'eggplant'), '🍆'],
  [anyOf('potato', 'yam', 'colocasia', 'tapioca'), '🥔'],
  [anyOf('greens', 'spinach', 'keerai', 'methi', 'amaranth', 'drumstick', 'leaves'), '🥬'],
  [anyOf('mushroom', 'mushrooms'), '🍄'],
  [anyOf('corn', 'maize'), '🌽'],
  [anyOf('beans', 'peas', 'cluster beans', 'field beans'), '🫛'],
  [anyOf('carrot', 'radish', 'beetroot'), '🥕'],
]

const CATEGORY_EMOJI = {
  curry: '🍛', condiment: '🥣', sweet: '🍮', indian: '🍛', snack: '🍘',
  grain: '🌾', veg: '🥬', fruit: '🍎', drink: '🥤', protein: '🫘', dairy: '🥛',
}

// Produce is matched against its own rules only. Run it through the dish rules
// as well and the fruit jamun comes out wearing gulab jamun's dessert emoji.
const pickEmoji = (name, category) => {
  const rules = category === 'veg' || category === 'fruit' ? PRODUCE_RULES : EMOJI_RULES
  return rules.find(([pattern]) => pattern.test(name))?.[1]
    || CATEGORY_EMOJI[category]
    || '🍽️'
}

// ── Rows the core database already covers ──────────────────────────────────
// Slug collisions are dropped automatically; these are the same food under a
// different name. The core rows are reference-sourced (USDA/IFCT), the CSV's
// are estimates, so the core wins every time.
const ALREADY_IN_CORE = new Set([
  'cooked-prawns',        // core: Prawns
  'cooked-chicken-breast', // core: Grilled chicken breast
  'white-steamed-rice',   // core: Cooked white rice
  'wheat-chapati',        // core: Roti
  'vada',                 // core: Medu vada
  'poha',                 // core: Poha
  'broken-wheat',         // core: Dalia
  'cooked-rajma',         // core: Cooked rajma
  'cooked-lentils',       // core: Cooked lentils
  'spiced-buttermilk',    // core: Buttermilk
  'tender-coconut-water', // core: Coconut water
])

// The CSV's beverage block from "Tender Coconut Water" on is filler: eleven
// different drinks all landing within 33–37 kcal/100g with the same 0.8 g
// protein and 1 g fat. Badam milk is nearer 90 kcal and jigarthanda 120, so
// these are not off-by-a-little, they are the same fabricated row repeated.
const REJECTED = new Map([
  ['panagam', 'filler beverage block — implausible 33 kcal/100g'],
  ['neer-mor', 'filler beverage block — implausible 36 kcal/100g'],
  ['badam-milk', 'filler beverage block — 35 kcal/100g, real value ~90'],
  ['rose-milk', 'filler beverage block — 34 kcal/100g, real value ~90'],
  ['jigarthanda', 'filler beverage block — 35 kcal/100g, real value ~120'],
  ['sarasaparilla-sherbet', 'filler beverage block — implausible 37 kcal/100g'],
  ['kambu-koozh', 'filler beverage block — implausible 33 kcal/100g'],
  ['ragi-malt', 'filler beverage block — implausible 35 kcal/100g'],
  ['sathu-maavu-drink', 'filler beverage block — implausible 34 kcal/100g'],
])

// ── Build ──────────────────────────────────────────────────────────────────
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Curated only. FOODS also contains the previous run's output — this script
// overwrites the very file foodDatabase.js imports — and comparing against
// that would mark all 1,198 rows as already present and write an empty list.
const core = FOODS.filter((food) => food.curated)
const coreIds = new Set(core.map((food) => food.id))
const coreAliases = new Set(core.flatMap((food) => food.aliases))

const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
const kept = []
const skipped = { core: [], rejected: [], duplicate: [], unmapped: [] }
const seen = new Set()
const usedSkips = new Set()

for (const row of rows) {
  const category = CATEGORY_MAP[row.Category]
  if (!category) { skipped.unmapped.push(`${row['Food Item']} (${row.Category})`); continue }

  const serving = Number.parseFloat(row['Serving Size'])
  if (!Number.isFinite(serving) || serving <= 0) {
    skipped.unmapped.push(`${row['Food Item']} (serving "${row['Serving Size']}")`)
    continue
  }

  const { name, aliases } = normaliseName(row['Food Item'])
  const id = slugify(name)

  if (REJECTED.has(id)) {
    usedSkips.add(id)
    skipped.rejected.push(`${name} — ${REJECTED.get(id)}`)
    continue
  }
  if (coreIds.has(id) || ALREADY_IN_CORE.has(id)) {
    usedSkips.add(id)
    skipped.core.push(name)
    continue
  }
  if (seen.has(id)) { skipped.duplicate.push(name); continue }
  seen.add(id)

  // The one transform that matters: per serving → per 100 g.
  const to100g = 100 / serving
  const scale = (column, decimals) => {
    const value = Number.parseFloat(row[column]) * to100g
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }

  kept.push({
    name,
    category,
    emoji: pickEmoji(name, category),
    serving: Math.round(serving),
    calories: scale('Calories (kcal)', 0),
    protein: scale('Protein (g)', 1),
    carbs: scale('Carbohydrates (g)', 1),
    fat: scale('Fat (g)', 1),
    fiber: scale('Fiber (g)', 1),
    aliases,
  })
}

// An alias that is another food's actual name, or one a core food already
// claims, makes a single query match two rows and rank between them
// arbitrarily. The name and the older claim both win over a late alias.
const allIds = new Set([...coreIds, ...seen])
for (const food of kept) {
  food.aliases = food.aliases.filter(
    (alias) => !coreAliases.has(alias) && !allIds.has(slugify(alias))
  )
}

kept.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

// ── Emit ───────────────────────────────────────────────────────────────────
const pad = (value, width) => String(value).padStart(width)
const serialise = (food) => {
  const aliases = food.aliases.length
    ? `, [${food.aliases.map((a) => `'${a.replace(/'/g, "\\'")}'`).join(', ')}]`
    : ''
  return (
    `  ['${food.name.replace(/'/g, "\\'")}',`.padEnd(46) +
    ` '${food.category}',`.padEnd(14) +
    ` '${food.emoji}',` +
    ` ${pad(food.serving, 3)},` +
    ` ${pad(food.calories, 3)},` +
    ` ${pad(food.protein.toFixed(1), 5)},` +
    ` ${pad(food.carbs.toFixed(1), 5)},` +
    ` ${pad(food.fat.toFixed(1), 5)},` +
    ` ${pad(food.fiber.toFixed(1), 4)}${aliases}],`
  )
}

const groups = []
for (const food of kept) {
  const last = groups[groups.length - 1]
  if (last && last.category === food.category) last.foods.push(food)
  else groups.push({ category: food.category, foods: [food] })
}

const body = groups
  .map(({ category, foods }) => {
    const rule = '─'.repeat(Math.max(4, 68 - category.length))
    return `  // ── ${category} ${rule}\n${foods.map(serialise).join('\n')}`
  })
  .join('\n\n')

const header = `/**
 * South Indian foods — generated, do not hand-edit.
 *
 * Source: scripts/data/south_indian_foods_nutrition.csv, converted by
 * scripts/import-south-indian.mjs. Re-run that script instead of editing here.
 *
 * Same tuple layout as the core database in foodDatabase.js, and the same
 * per-100g rule, with one difference:
 *
 *   [name, category, emoji, serving g, kcal, protein, carbs, fat, fibre, aliases?]
 *
 * There is no sugar or sodium column because the source has neither. Rather
 * than invent numbers for ${kept.length} foods, both are left \`null\` — meaning
 * "not known", not "none" — and the app renders them as such.
 *
 * Accuracy: these are estimates for home-style portions, not lab values, and
 * they are less carefully sourced than the core list. Where a food appears in
 * both, the core row wins.
 */

/* eslint-disable no-multi-spaces */
export const SOUTH_INDIAN_RAW = [
${body}
]
/* eslint-enable no-multi-spaces */

export const SOUTH_INDIAN_COUNT = ${kept.length}
`

fs.writeFileSync(OUT_PATH, header, 'utf8')

// ── Report ─────────────────────────────────────────────────────────────────
const report = (label, items) => {
  if (!items.length) return
  console.log(`\n${label} (${items.length}):`)
  console.log(items.map((item) => `  ${item}`).join('\n'))
}

// A manual skip that never fires is a rule about a food that no longer parses
// to the name it was written for — silently doing nothing is the bad case.
const unusedSkips = [...ALREADY_IN_CORE, ...REJECTED.keys()].filter((id) => !usedSkips.has(id))

console.log(`\nRead ${rows.length} rows from ${path.relative(process.cwd(), CSV_PATH)}`)
console.log(`Wrote ${kept.length} foods to ${path.relative(process.cwd(), OUT_PATH)}`)
report('Skipped — already in the core database', skipped.core)
report('Skipped — duplicate after normalising the name', skipped.duplicate)
report('Skipped — rejected as bad data', skipped.rejected)
report('Skipped — could not map', skipped.unmapped)
report('Stale skip rules — matched nothing, check the slug', unusedSkips)
console.log('\nNow run: npm run foods:check')
