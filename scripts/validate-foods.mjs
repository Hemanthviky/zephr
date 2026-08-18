/**
 * Sanity-checks src/data/foodDatabase.js after new rows are pasted in.
 *
 * Generated nutrition rows look plausible even when they're wrong, so this
 * catches the failure modes that reading the diff won't: duplicate slugs that
 * silently shadow an older food, a per-serving number pasted into a per-100g
 * column, macros that don't add up to the stated calories.
 *
 * Run: node scripts/validate-foods.mjs
 * Exits 1 on errors; warnings are advisory and don't fail the run.
 */
import { FOODS, CATEGORIES } from '../src/data/foodDatabase.js'

const errors = []
const warnings = []

const err = (food, msg) => errors.push(`${food.name} — ${msg}`)
const warn = (food, msg) => warnings.push(`${food.name} — ${msg}`)

// Alcohol carries 7 kcal/g that the macro columns don't record, so the Atwater
// check can't say anything useful about these rows.
const ALCOHOLIC = new Set(['beer', 'red-wine', 'white-wine', 'whisky', 'vodka', 'rum', 'gin'])

const seenIds = new Map()
const seenAliases = new Map()

for (const food of FOODS) {
  const { id, name, category, emoji, serving, calories, protein, carbs, fat, fiber, sugar, sodium } = food

  if (seenIds.has(id)) err(food, `duplicate id "${id}" (collides with "${seenIds.get(id)}")`)
  else seenIds.set(id, name)

  if (!CATEGORIES[category]) err(food, `unknown category "${category}"`)
  if (!emoji || [...emoji].length > 2) err(food, `emoji should be a single glyph, got "${emoji}"`)

  // sugar and sodium are the two the imported South Indian rows don't carry;
  // null there means "not known" and is allowed. Nothing else may be missing.
  const numbers = { serving, calories, protein, carbs, fat, fiber, sugar, sodium }
  for (const [field, value] of Object.entries(numbers)) {
    if (value === null && (field === 'sugar' || field === 'sodium')) continue
    if (typeof value !== 'number' || Number.isNaN(value)) err(food, `${field} is not a number`)
    else if (value < 0) err(food, `${field} is negative`)
  }

  // Plausibility bounds. Per 100 g, nothing edible clears these.
  if (calories > 900) err(food, `${calories} kcal/100g is impossible (pure fat is 900)`)
  if (protein > 100 || carbs > 100 || fat > 100) err(food, 'a macro exceeds 100 g per 100 g')
  if (protein + carbs + fat > 100) err(food, `macros sum to ${(protein + carbs + fat).toFixed(1)}g per 100g`)
  if (serving < 5 || serving > 600) warn(food, `serving of ${serving}g looks off`)
  if (sodium !== null && sodium > 5000) warn(food, `${sodium}mg sodium per 100g looks off`)

  // Reference tables really do publish sugar slightly above total carbs (milk,
  // for one) because the two are measured by different assays — so a small
  // overshoot is noise and only a real one means a transcription slip.
  if (sugar === null) { /* not known — nothing to check against */ }
  else if (sugar > carbs + 0.5) err(food, `sugar (${sugar}) exceeds carbs (${carbs})`)
  else if (sugar > carbs) warn(food, `sugar (${sugar}) marginally exceeds carbs (${carbs})`)
  if (fiber > carbs + 0.5) err(food, `fiber (${fiber}) exceeds carbs (${carbs})`)

  // Atwater: 4 kcal/g protein and carbs, 9 kcal/g fat, fibre nearer 2.
  if (!ALCOHOLIC.has(id)) {
    const atwater = 4 * protein + 4 * (carbs - fiber) + 9 * fat + 2 * fiber
    const drift = Math.abs(atwater - calories)
    if (drift > 30 && drift / Math.max(calories, 1) > 0.25) {
      err(food, `${calories} kcal but macros compute to ${atwater.toFixed(0)} kcal`)
    } else if (drift > 20 && drift / Math.max(calories, 1) > 0.15) {
      warn(food, `${calories} kcal vs ${atwater.toFixed(0)} kcal from macros`)
    }
  }

  for (const alias of food.aliases) {
    if (alias !== alias.toLowerCase()) err(food, `alias "${alias}" should be lowercase`)
    const owner = seenAliases.get(alias)
    if (owner && owner !== name) warn(food, `alias "${alias}" is also on "${owner}"`)
    else seenAliases.set(alias, name)
  }
}

const line = (s) => `  ${s}`
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s) — worth a look, not fatal:`)
  console.log(warnings.map(line).join('\n'))
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`)
  console.log(errors.map(line).join('\n'))
  console.log(`\n${FOODS.length} foods checked — fix the errors above.`)
  process.exit(1)
}

console.log(`\n${FOODS.length} foods checked, no errors.`)
