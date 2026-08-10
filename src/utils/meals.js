/**
 * Meal sections for the food log.
 *
 * Four sections follow the clock — morning, afternoon, evening, night — and
 * snacks deliberately do not. A snack isn't a time of day, it's a *kind* of
 * eating, and splitting it four ways would scatter what people think of as one
 * running total ("how much did I pick at today?") across the whole screen. So
 * there is exactly one Snacks section, and it sits at the bottom.
 */

export const MEALS = [
  { id: 'morning', label: 'Morning', icon: 'cooking', hint: 'Breakfast' },
  { id: 'afternoon', label: 'Afternoon', icon: 'plate', hint: 'Lunch' },
  { id: 'evening', label: 'Evening', icon: 'curry', hint: 'Dinner' },
  { id: 'night', label: 'Night', icon: 'moon', hint: 'Late' },
  { id: 'snack', label: 'Snacks', icon: 'cookie', hint: 'Any time' },
]

export const MEAL_IDS = MEALS.map((meal) => meal.id)

const byId = new Map(MEALS.map((meal) => [meal.id, meal]))
export const mealById = (id) => byId.get(id) ?? byId.get('snack')

/**
 * Which section the clock suggests. Only ever a *default* for the picker —
 * snacks are never auto-selected, because nothing about the time of day tells
 * you whether a banana was lunch or a snack. That's the user's call.
 */
export function mealForTime(date = new Date()) {
  const hour = date.getHours()
  if (hour < 11) return 'morning'
  if (hour < 16) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

/**
 * The section an existing entry belongs to.
 *
 * Rows logged before the meal column existed have `meal = null`, so they fall
 * back to whenever they were created. That keeps old logs sorted sensibly
 * instead of dumping months of history into one arbitrary bucket.
 */
export function resolveMeal(entry) {
  if (entry?.meal && byId.has(entry.meal)) return entry.meal
  if (entry?.created_at) {
    const created = new Date(entry.created_at)
    if (!Number.isNaN(created.getTime())) return mealForTime(created)
  }
  return 'morning'
}

/**
 * Group a day's entries into sections, in fixed order, dropping empty ones.
 * Fixed order matters: the log should look the same shape every day, so you
 * learn where to look rather than re-reading the headers each time.
 */
export function groupByMeal(entries = []) {
  const buckets = new Map(MEAL_IDS.map((id) => [id, []]))
  for (const entry of entries) {
    buckets.get(resolveMeal(entry)).push(entry)
  }

  return MEALS.map((meal) => ({ meal, entries: buckets.get(meal.id) })).filter(
    (section) => section.entries.length > 0
  )
}
