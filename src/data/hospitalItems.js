/**
 * The ward chart's catalogue.
 *
 * Two lists, because a fluid chart and a drug chart ask different questions.
 * Drinks are a closed list of *what was in the cup* — a nurse's chart says
 * "tender coconut 200 ml", never "beverage". Medicines are the opposite: the
 * name is personal (whatever the prescription says), so the list here is of
 * *forms*, and the name is typed once and then offered back as a suggestion.
 *
 * `typical` is the amount the picker pre-fills — the hospital tumbler, not a
 * guess. Every one of them stays editable.
 *
 * `tint` is per item rather than per module: on a chart where twelve rows share
 * one column, colour is what lets you find "the coconut ones" without reading.
 */

export const DRINKS = [
  { id: 'water', name: 'Water', icon: 'droplet', tint: '#3FA9E0', typical: 200 },
  { id: 'tomato_soup', name: 'Tomato soup', icon: 'soup', tint: '#E5573F', typical: 150 },
  { id: 'chicken_soup', name: 'Chicken soup', icon: 'bowlspoon', tint: '#D69A3C', typical: 150 },
  { id: 'coconut', name: 'Tender coconut water', icon: 'coconut', tint: '#12B39A', typical: 200 },
  { id: 'buttermilk', name: 'Buttermilk', icon: 'glassmilk', tint: '#7FA9C9', typical: 200 },
  { id: 'lassi', name: 'Lassi', icon: 'tropicaldrink', tint: '#D08BB0', typical: 200 },
  { id: 'watermelon_juice', name: 'Watermelon juice', icon: 'watermelon', tint: '#FF5A6E', typical: 200 },
  { id: 'muskmelon_juice', name: 'Musk melon juice', icon: 'melon', tint: '#F5A65B', typical: 200 },
  { id: 'orange_juice', name: 'Orange juice', icon: 'orange', tint: '#FF8A1F', typical: 200 },
  { id: 'tea', name: 'Tea', icon: 'teacup', tint: '#C08A4A', typical: 120 },
  { id: 'black_tea', name: 'Black tea', icon: 'teacup', tint: '#6B4423', typical: 120 },
  { id: 'coffee', name: 'Coffee', icon: 'hotbev', tint: '#8C6239', typical: 120 },
  { id: 'black_coffee', name: 'Black coffee', icon: 'hotbev', tint: '#3E2A1C', typical: 120 },
  { id: 'iced_tea', name: 'Iced tea', icon: 'cupstraw', tint: '#B5762E', typical: 250 },
  { id: 'kanji', name: 'Kanji / rice water', icon: 'rice', tint: '#C2A15A', typical: 150 },
  { id: 'ivfluid', name: 'IV fluid / drip', icon: 'syringe', tint: '#E0457B', typical: 500 },
  { id: 'ors', name: 'ORS / electrolyte', icon: 'saltshaker', tint: '#6C63E0', typical: 200 },
  { id: 'other', name: 'Something else', icon: 'droplet', tint: '#6E6659', typical: 200, custom: true },
]

export const MED_FORMS = [
  { id: 'tablet', name: 'Tablet', icon: 'pill', tint: '#FF5A38', unit: 'tablet', typical: 1 },
  { id: 'capsule', name: 'Capsule', icon: 'pill', tint: '#E0457B', unit: 'capsule', typical: 1 },
  { id: 'syrup', name: 'Syrup / liquid', icon: 'testtube', tint: '#E08600', unit: 'ml', typical: 5 },
  { id: 'injection', name: 'Injection', icon: 'syringe', tint: '#6C63E0', unit: 'ml', typical: 1 },
  { id: 'iv', name: 'IV medicine', icon: 'syringe', tint: '#3FA9E0', unit: 'ml', typical: 100 },
  { id: 'insulin', name: 'Insulin', icon: 'syringe', tint: '#12B39A', unit: 'unit', typical: 10 },
  { id: 'drops', name: 'Drops', icon: 'droplet', tint: '#4FA3C7', unit: 'drop', typical: 2 },
  { id: 'inhaler', name: 'Inhaler', icon: 'dash', tint: '#8C8CE0', unit: 'puff', typical: 2 },
  { id: 'sachet', name: 'Sachet / powder', icon: 'saltshaker', tint: '#C2A15A', unit: 'sachet', typical: 1 },
  { id: 'cream', name: 'Cream / ointment', icon: 'lotion', tint: '#B08968', unit: 'unit', typical: 1 },
  { id: 'other', name: 'Something else', icon: 'stethoscope', tint: '#6E6659', unit: 'unit', typical: 1 },
]

/**
 * Dose units. `step` is what the +/- buttons move by, `max` what the field will
 * accept — half a tablet is routine, half a millilitre of syrup is not, and a
 * single control can't guess that without being told per unit.
 */
export const UNIT_META = {
  ml: { label: 'ml', plural: 'ml', step: 5, max: 5000, half: false },
  tablet: { label: 'tablet', plural: 'tablets', step: 0.5, max: 20, half: true },
  capsule: { label: 'capsule', plural: 'capsules', step: 1, max: 20, half: false },
  mg: { label: 'mg', plural: 'mg', step: 50, max: 5000, half: false },
  drop: { label: 'drop', plural: 'drops', step: 1, max: 50, half: false },
  puff: { label: 'puff', plural: 'puffs', step: 1, max: 20, half: false },
  sachet: { label: 'sachet', plural: 'sachets', step: 1, max: 10, half: false },
  unit: { label: 'unit', plural: 'units', step: 1, max: 200, half: false },
  tsp: { label: 'tsp', plural: 'tsp', step: 0.5, max: 20, half: true },
}

/** The units offered on the dose row, in the order a drug chart uses them. */
export const MED_UNITS = ['tablet', 'capsule', 'ml', 'mg', 'drop', 'puff', 'sachet', 'unit', 'tsp']

/** Quick amounts under the ml field — the cups a ward actually pours. */
export const ML_PRESETS = [50, 100, 150, 200, 250, 300, 500]

const drinkById = new Map(DRINKS.map((d) => [d.id, d]))
const formById = new Map(MED_FORMS.map((f) => [f.id, f]))

export const getDrink = (id) => drinkById.get(id) ?? null
export const getMedForm = (id) => formById.get(id) ?? null

/**
 * Display metadata for a saved row.
 *
 * Rows keep their own `name`, so a catalogue entry renamed later never rewrites
 * history; only the icon and tint are looked up, and a row whose `item` we no
 * longer recognise still renders as itself.
 */
export function describeLog(entry) {
  if (!entry) return { icon: 'droplet', tint: '#6E6659' }
  const source = entry.kind === 'med' ? formById.get(entry.item) : drinkById.get(entry.item)
  if (source) return { icon: source.icon, tint: source.tint }
  return entry.kind === 'med'
    ? { icon: 'pill', tint: '#FF5A38' }
    : { icon: 'droplet', tint: '#6E6659' }
}
