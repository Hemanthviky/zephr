/**
 * Turning body stats into a daily calorie and macro target.
 *
 * Uses **Mifflin–St Jeor**, which is the equation most dietetic bodies default
 * to for healthy adults — it beats Harris–Benedict on modern populations and
 * needs nothing more than height, weight, age and sex.
 *
 *   BMR  = 10·kg + 6.25·cm − 5·age + s      (s = +5 male, −161 female)
 *   TDEE = BMR × activity factor
 *
 * Everything here is an estimate of an average, not a measurement of a person.
 * Real expenditure varies by ±10% between two people with identical inputs, so
 * the UI presents the result as a starting point to adjust, never as a verdict.
 */

export const SEXES = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
]

/** Standard multipliers; the descriptions matter more than the numbers here. */
export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  { id: 'light', label: 'Light', hint: 'Exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderate', hint: 'Exercise 3–5 days a week', factor: 1.55 },
  { id: 'active', label: 'Active', hint: 'Hard exercise 6–7 days', factor: 1.725 },
  { id: 'athlete', label: 'Athlete', hint: 'Training twice a day, or physical job', factor: 1.9 },
]

export const AIMS = [
  { id: 'lose', label: 'Lose weight', hint: '−20%', adjust: -0.2 },
  { id: 'maintain', label: 'Maintain', hint: 'TDEE', adjust: 0 },
  { id: 'gain', label: 'Build', hint: '+12%', adjust: 0.12 },
]

export const DEFAULT_BODY = {
  height_cm: '',
  weight_kg: '',
  age: '',
  sex: 'male',
  activity: 'light',
  aim: 'maintain',
}

const factorFor = (id) => ACTIVITY_LEVELS.find((a) => a.id === id)?.factor ?? 1.375
const adjustFor = (id) => AIMS.find((a) => a.id === id)?.adjust ?? 0

/** Every field the equation needs, present and in a plausible range. */
export function canCalculate(body) {
  const height = Number(body?.height_cm)
  const weight = Number(body?.weight_kg)
  const age = Number(body?.age)

  return (
    height >= 80 && height <= 260 &&
    weight >= 20 && weight <= 400 &&
    age >= 13 && age <= 120 &&
    Boolean(body?.sex)
  )
}

/**
 * @returns {{bmr, tdee, calories, protein, carbs, fat} | null}
 *
 * Macros follow the split most sports-nutrition guidance lands on:
 *   • protein  1.8 g per kg of bodyweight — scales with the person, not the
 *              calorie budget, which is the whole point of a protein target
 *   • fat      25% of calories, with a floor of 0.5 g/kg so a hard cut never
 *              prescribes a hormonally silly number
 *   • carbs    whatever's left, because they're the flexible one
 */
export function calculateTargets(body) {
  if (!canCalculate(body)) return null

  const height = Number(body.height_cm)
  const weight = Number(body.weight_kg)
  const age = Number(body.age)

  const bmr = 10 * weight + 6.25 * height - 5 * age + (body.sex === 'female' ? -161 : 5)
  const tdee = bmr * factorFor(body.activity)
  const calories = Math.round((tdee * (1 + adjustFor(body.aim))) / 10) * 10

  const protein = Math.round(weight * 1.8)
  const fat = Math.max(Math.round((calories * 0.25) / 9), Math.round(weight * 0.5))
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    carbs,
    fat,
  }
}

/** BMI, purely as a sanity read-out next to the inputs. */
export function bmiOf(body) {
  const height = Number(body?.height_cm)
  const weight = Number(body?.weight_kg)
  if (!(height > 0 && weight > 0)) return null

  const metres = height / 100
  const value = weight / (metres * metres)

  return {
    value: Math.round(value * 10) / 10,
    label:
      value < 18.5 ? 'Under' : value < 25 ? 'Healthy' : value < 30 ? 'Over' : 'Obese',
  }
}
