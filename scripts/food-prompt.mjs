/**
 * Prints a ready-to-paste prompt for generating new foodDatabase rows.
 *
 * The point of generating the prompt instead of keeping it in a doc is the
 * "already have" list: it's read live from the database, so a batch can't come
 * back full of rows that are already there.
 *
 * Run: node scripts/food-prompt.mjs <category> [count]
 *   e.g. node scripts/food-prompt.mjs indian 40
 */
import { FOODS, CATEGORIES } from '../src/data/foodDatabase.js'

const [category, countArg] = process.argv.slice(2)
const count = Number(countArg) || 40

if (!category || !CATEGORIES[category]) {
  console.error(`Usage: node scripts/food-prompt.mjs <category> [count]`)
  console.error(`Categories: ${Object.keys(CATEGORIES).join(', ')}`)
  process.exit(1)
}

const inCategory = FOODS.filter((f) => f.category === category)
const existing = inCategory.map((f) => f.name).join(', ')
const samples = inCategory.slice(0, 3)

const row = (f) =>
  `  ['${f.name}', '${f.category}', '${f.emoji}', ${f.serving}, ${f.calories}, ${f.protein}, ` +
  `${f.carbs}, ${f.fat}, ${f.fiber}, ${f.sugar}, ${f.sodium}${
    f.aliases.length ? `, [${f.aliases.map((a) => `'${a}'`).join(', ')}]` : ''
  }],`

console.log(`
You are compiling rows for a nutrition database. Output ${count} new "${CATEGORIES[category].label}" foods.

FORMAT — one JavaScript array literal per food, nothing else. Exactly this order:
  [name, category, emoji, serving, kcal, protein, carbs, fat, fibre, sugar, sodium, aliases?]

  name      Title case, singular, describes the food as eaten ("Grilled chicken breast",
            not "Chicken"). State the cooking method when it changes the numbers.
  category  Always the literal string '${category}'.
  emoji     ONE emoji, the closest available match.
  serving   Grams one person eats in a single sitting (a whole number). Drinks: millilitres.
  kcal      PER 100 GRAMS. Not per serving. This is the rule people break.
  protein / carbs / fat / fibre / sugar   grams PER 100 G, one decimal place.
            carbs is TOTAL carbohydrate, so it must be >= sugar and >= fibre.
  sodium    milligrams PER 100 G, whole number.
  aliases   Optional array of lowercase alternate search terms — regional names,
            common misspellings, brand-generic names. Omit entirely if there are none.

HARD RULES
1. Every nutrition number is per 100 g of the food as eaten. Only \`serving\` is a portion size.
2. Before you print each row, check it against the Atwater factors:
   4*protein + 4*(carbs - fibre) + 9*fat + 2*fibre must land within ~15% of the kcal you
   wrote. If it doesn't, your numbers are wrong — fix them, don't print them.
3. Use published reference values (USDA FoodData Central; IFCT for Indian dishes). If you
   are unsure of a food, leave it out rather than estimating. A short accurate list beats
   a long invented one.
4. No duplicates of, and no trivial restatements of, the foods listed under ALREADY HAVE.
   "Cooked white rice" already exists, so "Steamed rice" and "Plain rice" are duplicates —
   add them as aliases in a separate note instead, not as rows.
5. Prefer foods people actually log day to day over exotic completeness.
6. Output ONLY the rows. No prose, no markdown fences, no numbering, no trailing commentary.

EXAMPLE ROWS (this is the exact shape and precision I want back):
${samples.map(row).join('\n')}

ALREADY HAVE (${inCategory.length} foods — do not repeat any of these):
${existing}
`)
