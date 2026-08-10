/**
 * Pure nutrition arithmetic. No React, no Supabase — everything here is a
 * function of its arguments so the numbers on screen are trivial to reason
 * about (and to unit test later).
 *
 * The whole app rests on one rule: the food database stores values *per 100g*,
 * and every displayed number is that value scaled by (grams / 100).
 */

export const MACROS = ['protein', 'carbs', 'fat']

/** Display metadata for the three macros — colours match tailwind.config.js. */
export const MACRO_META = {
  protein: { label: 'Protein', short: 'P', ring: '#FF5A38', track: '#FFE4DC', kcalPerGram: 4 },
  carbs: { label: 'Carbs', short: 'C', ring: '#FFA51F', track: '#FFEFCE', kcalPerGram: 4 },
  fat: { label: 'Fat', short: 'F', ring: '#12B39A', track: '#D6F5EC', kcalPerGram: 9 },
}

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']

/** Round to 1 decimal, but drop the ".0" — 12.0 reads worse than 12. */
export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}

export function round0(n) {
  return Math.round(Number(n) || 0)
}

/**
 * Scale a food's per-100g profile to an arbitrary gram amount.
 * Returns a plain object shaped exactly like an `entries` row payload.
 */
export function scaleFood(food, grams) {
  const factor = (Number(grams) || 0) / 100
  const scaled = {}
  for (const key of NUTRIENTS) {
    scaled[key] = round1((food[key] || 0) * factor)
  }
  return scaled
}

/** Sum every nutrient across a day's entries. */
export function sumEntries(entries = []) {
  const totals = Object.fromEntries(NUTRIENTS.map((k) => [k, 0]))
  for (const entry of entries) {
    for (const key of NUTRIENTS) {
      totals[key] += Number(entry[key]) || 0
    }
  }
  for (const key of NUTRIENTS) totals[key] = round1(totals[key])
  return totals
}

/**
 * How much of the goal is left. Negative means over budget — we keep the sign
 * so the UI can say "240 over" instead of clamping to zero and lying.
 */
export function remaining(totals, goals) {
  return {
    calories: round0((goals?.calories || 0) - (totals?.calories || 0)),
    protein: round0((goals?.protein || 0) - (totals?.protein || 0)),
    carbs: round0((goals?.carbs || 0) - (totals?.carbs || 0)),
    fat: round0((goals?.fat || 0) - (totals?.fat || 0)),
  }
}

/** Fraction of a goal consumed, unclamped (1.2 = 120%). */
export function ratio(value, goal) {
  if (!goal || goal <= 0) return 0
  return (Number(value) || 0) / goal
}

/** Same, clamped to [0, 1] — for anything driving a bar or arc length. */
export function clampedRatio(value, goal) {
  return Math.min(1, Math.max(0, ratio(value, goal)))
}

export function percent(value, goal) {
  return Math.round(ratio(value, goal) * 100)
}

/**
 * Traffic light for a macro or calorie total:
 *   'empty'  nothing logged yet
 *   'under'  still room
 *   'hit'    within the 'on target' band (95–105% of goal)
 *   'over'   past the goal
 */
export function goalStatus(value, goal) {
  if (!goal || goal <= 0) return 'empty'
  const r = ratio(value, goal)
  if (r === 0) return 'empty'
  if (r > 1.05) return 'over'
  if (r >= 0.95) return 'hit'
  return 'under'
}

/**
 * Share of energy coming from each macro, as percentages that add to 100.
 * Uses macro-derived calories rather than the logged calorie number, because
 * the two disagree slightly for most real foods (fibre, alcohol, rounding).
 */
export function macroSplit(totals) {
  const energy = MACROS.map((m) => (Number(totals[m]) || 0) * MACRO_META[m].kcalPerGram)
  const sum = energy.reduce((a, b) => a + b, 0)
  if (sum <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return Object.fromEntries(MACROS.map((m, i) => [m, Math.round((energy[i] / sum) * 100)]))
}

/** 1240 → "1,240". Big numbers need separators to stay readable at a glance. */
export function formatNumber(n) {
  return round0(n).toLocaleString()
}

/** 250 → "250 g", 1200 → "1.2 kg" — used on entry rows. */
export function formatGrams(grams) {
  const g = Number(grams) || 0
  return g >= 1000 ? `${round1(g / 1000)} kg` : `${round1(g)} g`
}
