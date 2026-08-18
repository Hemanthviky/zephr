/**
 * Zephr's built-in nutrition database.
 *
 * Every row is **per 100 g** — that invariant is what makes `scaleFood()` in
 * utils/nutritionMath.js a one-liner. `serving` is the amount a normal person
 * actually eats in one go (one banana, one dosa, one mug of chai), and it's what
 * we pre-fill the grams field with. Beverages use grams ≈ millilitres.
 *
 * Two lists make up the database:
 *
 *   - the core below: ~160 foods, rounded reference values for cooked/ready-to-
 *     eat portions, drawn from USDA FoodData Central and IFCT (Indian Food
 *     Composition Tables) where the dish is Indian.
 *   - southIndianFoods.js: ~1200 South Indian dishes imported from a CSV. Less
 *     carefully sourced, and carrying no sugar or sodium figures — those come
 *     through as `null`, which means "not known", not "none".
 *
 * The core wins any name the two share; scripts/import-south-indian.mjs drops
 * the duplicates at import time rather than at runtime.
 *
 * Either list is good enough to steer a day's eating; neither is a lab
 * measurement of your particular plate.
 *
 * Tuple layout keeps the rows scannable in a diff:
 *   [name, category, emoji, serving g, kcal, protein, carbs, fat, fibre, sugar, sodium mg, aliases?]
 */
// Extension included on purpose: the foods:check and foods:prompt scripts load
// this file with plain Node, which does not resolve extensionless paths.
import { SOUTH_INDIAN_RAW } from './southIndianFoods.js'

export const CATEGORIES = {
  fruit: { label: 'Fruit', emoji: '🍓' },
  veg: { label: 'Veg', emoji: '🥦' },
  grain: { label: 'Grains', emoji: '🍞' },
  protein: { label: 'Protein', emoji: '🍗' },
  dairy: { label: 'Dairy', emoji: '🧀' },
  indian: { label: 'Indian', emoji: '🍛' },
  curry: { label: 'Curries', emoji: '🍛' },
  condiment: { label: 'Chutneys & podis', emoji: '🥣' },
  sweet: { label: 'Sweets', emoji: '🍮' },
  fastfood: { label: 'Fast food', emoji: '🍔' },
  snack: { label: 'Snacks', emoji: '🍪' },
  drink: { label: 'Drinks', emoji: '🥤' },
}

/* eslint-disable no-multi-spaces */
const RAW = [
  // ── Fruit ────────────────────────────────────────────────────────────────
  ['Apple',                  'fruit', '🍎', 182,  52, 0.3, 13.8,  0.2,  2.4, 10.4,   1],
  ['Banana',                 'fruit', '🍌', 118,  89, 1.1, 22.8,  0.3,  2.6, 12.2,   1],
  ['Orange',                 'fruit', '🍊', 131,  47, 0.9, 11.8,  0.1,  2.4,  9.4,   0],
  ['Mango',                  'fruit', '🥭', 165,  60, 0.8, 15.0,  0.4,  1.6, 13.7,   1],
  ['Grapes',                 'fruit', '🍇', 150,  69, 0.7, 18.1,  0.2,  0.9, 15.5,   2],
  ['Watermelon',             'fruit', '🍉', 280,  30, 0.6,  7.6,  0.2,  0.4,  6.2,   1],
  ['Papaya',                 'fruit', '🫐', 145,  43, 0.5, 10.8,  0.3,  1.7,  7.8,   8],
  ['Pineapple',              'fruit', '🍍', 165,  50, 0.5, 13.1,  0.1,  1.4,  9.9,   1],
  ['Strawberries',           'fruit', '🍓', 150,  32, 0.7,  7.7,  0.3,  2.0,  4.9,   1],
  ['Blueberries',            'fruit', '🫐', 145,  57, 0.7, 14.5,  0.3,  2.4, 10.0,   1],
  ['Pomegranate',            'fruit', '🍎', 174,  83, 1.7, 18.7,  1.2,  4.0, 13.7,   3, ['anar']],
  ['Guava',                  'fruit', '🍏', 165,  68, 2.6, 14.3,  1.0,  5.4,  8.9,   2, ['amrud']],
  ['Pear',                   'fruit', '🍐', 178,  57, 0.4, 15.2,  0.1,  3.1,  9.8,   1],
  ['Kiwi',                   'fruit', '🥝',  75,  61, 1.1, 14.7,  0.5,  3.0,  9.0,   3],
  ['Avocado',                'fruit', '🥑', 150, 160, 2.0,  8.5, 14.7,  6.7,  0.7,   7],
  ['Dates',                  'fruit', '🌴',  40, 277, 1.8, 75.0,  0.2,  6.7, 66.5,   1, ['khajur']],

  // ── Vegetables ───────────────────────────────────────────────────────────
  ['Broccoli',               'veg', '🥦',  90,  34, 2.8,  6.6, 0.4, 2.6, 1.7,  33],
  ['Spinach',                'veg', '🥬', 100,  23, 2.9,  3.6, 0.4, 2.2, 0.4,  79, ['palak']],
  ['Carrot',                 'veg', '🥕',  80,  41, 0.9,  9.6, 0.2, 2.8, 4.7,  69, ['gajar']],
  ['Tomato',                 'veg', '🍅', 120,  18, 0.9,  3.9, 0.2, 1.2, 2.6,   5],
  ['Cucumber',               'veg', '🥒', 120,  15, 0.7,  3.6, 0.1, 0.5, 1.7,   2, ['kheera']],
  ['Bell pepper',            'veg', '🫑', 120,  31, 1.0,  6.0, 0.3, 2.1, 4.2,   4, ['capsicum', 'shimla mirch']],
  ['Cauliflower',            'veg', '🥬', 100,  25, 1.9,  5.0, 0.3, 2.0, 1.9,  30, ['gobi']],
  ['Cabbage',                'veg', '🥬', 100,  25, 1.3,  5.8, 0.1, 2.5, 3.2,  18, ['patta gobi']],
  ['Onion',                  'veg', '🧅', 110,  40, 1.1,  9.3, 0.1, 1.7, 4.2,   4, ['pyaz']],
  ['Boiled potato',          'veg', '🥔', 150,  87, 1.9, 20.1, 0.1, 1.8, 0.9,   4, ['aloo']],
  ['Sweet potato',           'veg', '🍠', 130,  86, 1.6, 20.1, 0.1, 3.0, 4.2,  55, ['shakarkandi']],
  ['Green peas',             'veg', '🟢',  80,  81, 5.4, 14.5, 0.4, 5.7, 5.7,   5, ['matar']],
  ['Okra',                   'veg', '🥬', 100,  33, 1.9,  7.5, 0.2, 3.2, 1.5,   7, ['bhindi', 'ladies finger']],
  ['Beetroot',               'veg', '🍠',  85,  43, 1.6,  9.6, 0.2, 2.8, 6.8,  78, ['chukandar']],
  ['Mushrooms',              'veg', '🍄',  90,  22, 3.1,  3.3, 0.3, 1.0, 2.0,   5],
  ['Sweet corn',             'veg', '🌽', 100,  96, 3.4, 21.0, 1.5, 2.4, 4.5,  15, ['bhutta']],
  ['Bottle gourd',           'veg', '🥒', 150,  14, 0.6,  3.4, 0.0, 0.5, 1.6,   2, ['lauki', 'dudhi']],
  ['Green salad',            'veg', '🥗', 150,  27, 1.4,  5.2, 0.3, 1.8, 2.6,  20],

  // ── Grains & starches ────────────────────────────────────────────────────
  ['Cooked white rice',      'grain', '🍚', 150, 130,  2.7, 28.2, 0.3,  0.4, 0.1,   1, ['chawal']],
  ['Cooked brown rice',      'grain', '🍚', 150, 123,  2.7, 25.6, 1.0,  1.6, 0.4,   4],
  ['Roti',                   'grain', '🫓',  40, 297,  9.5, 52.0, 6.2,  6.6, 1.5, 320, ['chapati', 'phulka']],
  ['Naan',                   'grain', '🫓',  90, 310,  8.7, 50.4, 7.5,  2.2, 3.5, 480],
  ['White bread',            'grain', '🍞',  50, 265,  9.0, 49.0, 3.2,  2.7, 5.0, 490, ['toast']],
  ['Whole wheat bread',      'grain', '🍞',  55, 247, 13.0, 41.0, 3.4,  6.8, 5.6, 450, ['brown bread']],
  ['Sourdough bread',        'grain', '🍞',  55, 260,  9.6, 51.0, 1.6,  2.4, 2.2, 520],
  ['Rolled oats',            'grain', '🥣',  40, 379, 13.2, 67.7, 6.5, 10.1, 1.0,   6, ['oatmeal']],
  ['Muesli',                 'grain', '🥣',  45, 375, 10.0, 66.0, 6.0,  7.7, 16.0,  30],
  ['Cornflakes',             'grain', '🥣',  30, 357,  7.5, 84.0, 0.4,  3.3, 8.5, 729],
  ['Cooked quinoa',          'grain', '🌾', 150, 120,  4.4, 21.3, 1.9,  2.8, 0.9,   7],
  ['Cooked pasta',           'grain', '🍝', 180, 158,  5.8, 30.9, 0.9,  1.8, 0.6,   5, ['spaghetti', 'penne']],
  ['Cooked couscous',        'grain', '🌾', 150, 112,  3.8, 23.2, 0.2,  1.4, 0.1,   5],
  ['Rice noodles',           'grain', '🍜', 180, 109,  0.9, 24.9, 0.2,  1.0, 0.1,  19],
  ['Poha',                   'grain', '🍚', 200, 130,  2.5, 27.0, 1.8,  1.2, 0.6, 300, ['flattened rice']],
  ['Upma',                   'grain', '🍚', 200, 145,  3.4, 22.0, 4.6,  1.8, 1.2, 320],
  ['Dalia',                  'grain', '🥣', 200, 124,  4.2, 25.0, 0.6,  3.5, 0.3,   5, ['broken wheat', 'porridge']],
  ['Bagel',                  'grain', '🥯',  95, 250, 10.0, 49.0, 1.5,  2.1, 5.4, 430],

  // ── Protein ──────────────────────────────────────────────────────────────
  ['Grilled chicken breast', 'protein', '🍗', 150, 165, 31.0,  0.0,  3.6,  0.0, 0.0,  74],
  ['Roast chicken thigh',    'protein', '🍗', 120, 209, 26.0,  0.0, 10.9,  0.0, 0.0,  88],
  ['Boiled egg',             'protein', '🥚',  50, 155, 12.6,  1.1, 10.6,  0.0, 1.1, 124, ['anda']],
  ['Egg white',              'protein', '🥚',  33,  52, 10.9,  0.7,  0.2,  0.0, 0.7, 166],
  ['Baked salmon',           'protein', '🐟', 140, 208, 20.4,  0.0, 13.4,  0.0, 0.0,  59],
  ['Canned tuna',            'protein', '🐟', 100, 116, 25.5,  0.0,  0.8,  0.0, 0.0, 247],
  ['Prawns',                 'protein', '🍤', 100,  99, 24.0,  0.2,  0.3,  0.0, 0.0, 111, ['shrimp', 'jhinga']],
  ['Rohu fish curry',        'protein', '🐟', 150,  97, 16.6,  1.2,  3.2,  0.2, 0.4,  60, ['fish curry']],
  ['Mutton curry',           'protein', '🍖', 200, 190, 16.0,  4.5, 12.0,  0.8, 1.5, 420, ['lamb curry']],
  ['Beef mince',             'protein', '🥩', 120, 250, 26.0,  0.0, 15.0,  0.0, 0.0,  72, ['keema']],
  ['Pork chop',              'protein', '🥩', 130, 231, 27.0,  0.0, 13.0,  0.0, 0.0,  62],
  ['Turkey breast',          'protein', '🦃', 120, 135, 30.0,  0.0,  0.7,  0.0, 0.0,  63],
  ['Tofu',                   'protein', '🧊', 120, 144, 15.8,  2.8,  8.7,  2.3, 0.6,  14],
  ['Tempeh',                 'protein', '🧊', 100, 192, 20.3,  7.6, 10.8,  0.0, 0.0,   9],
  ['Soya chunks',            'protein', '🫘',  30, 345, 52.0, 33.0,  0.5, 13.0, 6.0,   5, ['soy nuggets']],
  ['Cooked rajma',           'protein', '🫘', 150, 127,  8.7, 22.8,  0.5,  6.4, 0.3,   2, ['kidney beans']],
  ['Boiled chickpeas',       'protein', '🫘', 150, 164,  8.9, 27.4,  2.6,  7.6, 4.8,   7, ['chana', 'garbanzo']],
  ['Black beans',            'protein', '🫘', 150, 132,  8.9, 23.7,  0.5,  8.7, 0.3,   2],
  ['Cooked lentils',         'protein', '🫘', 150, 116,  9.0, 20.1,  0.4,  7.9, 1.8,   2, ['dal', 'masoor']],
  ['Peanuts',                'protein', '🥜',  30, 567, 25.8, 16.1, 49.2,  8.5, 4.7,  18, ['moongphali']],
  ['Almonds',                'protein', '🥜',  28, 579, 21.2, 21.6, 49.9, 12.5, 4.4,   1, ['badam']],
  ['Walnuts',                'protein', '🥜',  28, 654, 15.2, 13.7, 65.2,  6.7, 2.6,   2, ['akhrot']],
  ['Cashews',                'protein', '🥜',  28, 553, 18.2, 30.2, 43.9,  3.3, 5.9,  12, ['kaju']],
  ['Pumpkin seeds',          'protein', '🎃',  28, 559, 30.2, 10.7, 49.0,  6.0, 1.4,   7],
  ['Chia seeds',             'protein', '🌱',  20, 486, 16.5, 42.1, 30.7, 34.4, 0.0,  16],
  ['Peanut butter',          'protein', '🥜',  32, 588, 25.1, 20.0, 50.4,  6.0, 9.2, 429],

  // ── Dairy ────────────────────────────────────────────────────────────────
  ['Whole milk',             'dairy', '🥛', 250,  61,  3.2, 4.8,  3.3, 0.0, 5.1,  43, ['doodh']],
  ['Skim milk',              'dairy', '🥛', 250,  34,  3.4, 5.0,  0.1, 0.0, 5.1,  42, ['toned milk']],
  ['Curd',                   'dairy', '🥣', 150,  61,  3.5, 4.7,  3.3, 0.0, 4.7,  46, ['dahi', 'yogurt']],
  ['Greek yogurt',           'dairy', '🥣', 170,  97,  9.0, 3.9,  5.0, 0.0, 3.6,  35, ['hung curd']],
  ['Paneer',                 'dairy', '🧀', 100, 296, 18.9, 3.6, 23.0, 0.0, 2.6,  18, ['cottage cheese']],
  ['Cheddar cheese',         'dairy', '🧀',  30, 403, 24.9, 1.3, 33.1, 0.0, 0.5, 653],
  ['Mozzarella',             'dairy', '🧀',  30, 300, 22.2, 2.2, 22.4, 0.0, 1.0, 627],
  ['Cream cheese',           'dairy', '🧀',  30, 342,  6.2, 4.1, 34.0, 0.0, 3.8, 314],
  ['Butter',                 'dairy', '🧈',  10, 717,  0.9, 0.1, 81.1, 0.0, 0.1, 643, ['makhan']],
  ['Ghee',                   'dairy', '🧈',  10, 900,  0.0, 0.0,100.0, 0.0, 0.0,   2, ['clarified butter']],
  ['Buttermilk',             'dairy', '🥛', 200,  40,  3.3, 4.8,  0.9, 0.0, 4.8, 105, ['chaas', 'chhach']],
  ['Whey protein powder',    'dairy', '💪',  30, 380, 78.0, 8.0,  5.0, 1.0, 5.0, 280, ['protein shake']],

  // ── Indian dishes ────────────────────────────────────────────────────────
  ['Idli',                   'indian', '⚪',  80, 132,  3.4, 26.6,  1.2, 1.4,  0.5, 210],
  ['Plain dosa',             'indian', '🥞', 100, 168,  3.9, 28.0,  4.5, 1.5,  0.8, 250],
  ['Masala dosa',            'indian', '🥞', 200, 187,  4.1, 29.0,  6.2, 2.2,  1.5, 320],
  ['Medu vada',              'indian', '🍩',  45, 285,  7.5, 34.0, 13.0, 3.0,  1.0, 380, ['vada']],
  ['Uttapam',                'indian', '🥞', 120, 175,  4.2, 27.0,  5.5, 2.0,  1.2, 300],
  ['Chicken biryani',        'indian', '🍛', 300, 178,  9.5, 21.0,  6.5, 1.0,  1.2, 420],
  ['Veg biryani',            'indian', '🍛', 300, 152,  3.6, 24.0,  4.8, 1.6,  1.8, 380],
  ['Dal tadka',              'indian', '🍲', 150, 118,  5.5, 14.0,  4.4, 3.4,  1.0, 400, ['yellow dal']],
  ['Dal makhani',            'indian', '🍲', 150, 165,  6.0, 13.0,  9.6, 4.0,  2.0, 430],
  ['Sambar',                 'indian', '🍲', 150,  85,  4.0, 11.0,  2.6, 2.8,  2.0, 390],
  ['Rasam',                  'indian', '🍲', 150,  35,  1.2,  5.0,  1.2, 0.8,  1.4, 350],
  ['Palak paneer',           'indian', '🍛', 200, 180,  8.4,  6.5, 13.5, 2.4,  2.0, 420],
  ['Paneer butter masala',   'indian', '🍛', 200, 245,  8.8,  9.0, 19.5, 1.8,  4.5, 480, ['paneer makhani']],
  ['Butter chicken',         'indian', '🍛', 200, 190, 13.5,  5.5, 12.8, 0.8,  3.2, 460, ['murgh makhani']],
  ['Chicken tikka',          'indian', '🍢', 150, 195, 25.0,  3.5,  9.0, 0.5,  1.5, 480],
  ['Egg curry',              'indian', '🍛', 200, 145,  8.5,  5.5, 10.2, 1.0,  2.5, 400, ['anda curry']],
  ['Chole',                  'indian', '🍲', 180, 145,  6.2, 18.0,  5.5, 5.2,  3.0, 430, ['chana masala']],
  ['Bhature',                'indian', '🫓',  80, 330,  7.2, 43.0, 14.5, 1.8,  2.5, 380],
  ['Rajma curry',            'indian', '🍲', 180, 125,  6.4, 16.0,  4.2, 5.0,  2.2, 400],
  ['Aloo paratha',           'indian', '🫓', 120, 265,  5.6, 34.0, 11.5, 3.0,  1.2, 350],
  ['Poori',                  'indian', '🫓',  30, 375,  6.8, 44.0, 19.0, 2.0,  1.0, 300, ['puri']],
  ['Pav bhaji',              'indian', '🍛', 250, 155,  3.4, 18.0,  8.0, 3.2,  4.0, 470],
  ['Khichdi',                'indian', '🍲', 250, 120,  4.4, 19.0,  2.8, 2.0,  0.8, 320],
  ['Curd rice',              'indian', '🍚', 250, 110,  3.2, 16.0,  3.5, 0.6,  1.6, 300, ['thayir sadam']],
  ['Samosa',                 'indian', '🥟',  60, 308,  5.2, 32.0, 17.9, 2.6,  1.5, 420],
  ['Gulab jamun',            'indian', '🍡',  40, 310,  4.2, 42.0, 14.0, 0.4, 34.0,  90],
  ['Jalebi',                 'indian', '🍥',  35, 380,  2.5, 60.0, 14.5, 0.3, 45.0,  65],

  // ── Fast food ────────────────────────────────────────────────────────────
  ['Cheese pizza',           'fastfood', '🍕', 125, 266, 11.0, 33.0, 10.0, 2.3, 3.6, 598],
  ['Pepperoni pizza',        'fastfood', '🍕', 130, 298, 13.0, 30.0, 13.5, 2.3, 3.5, 700],
  ['Cheeseburger',           'fastfood', '🍔', 165, 303, 15.5, 25.0, 15.5, 1.5, 5.5, 620],
  ['Veg burger',             'fastfood', '🍔', 160, 240,  7.5, 32.0,  9.5, 2.5, 5.0, 500],
  ['French fries',           'fastfood', '🍟', 115, 312,  3.4, 41.0, 15.0, 3.8, 0.3, 210],
  ['Fried chicken',          'fastfood', '🍗', 140, 285, 22.0, 12.0, 17.0, 0.5, 0.0, 640],
  ['Chicken nuggets',        'fastfood', '🍗', 100, 296, 15.5, 16.0, 19.0, 1.0, 0.5, 560],
  ['Hot dog',                'fastfood', '🌭', 100, 290, 10.4, 22.0, 17.5, 0.9, 4.5, 810],
  ['Chicken shawarma',       'fastfood', '🌯', 250, 210, 15.0, 18.0,  9.0, 1.5, 2.0, 520],
  ['Chicken wrap',           'fastfood', '🌯', 220, 205, 12.0, 22.0,  7.5, 1.8, 2.4, 520],
  ['Veg kathi roll',         'fastfood', '🌯', 180, 215,  6.0, 27.0,  9.0, 2.4, 2.6, 480],
  ['Grilled cheese sandwich','fastfood', '🥪', 130, 290, 11.0, 28.0, 15.0, 1.8, 3.5, 620],
  ['Steamed momos',          'fastfood', '🥟', 120, 175,  7.0, 25.0,  5.0, 1.4, 1.2, 380, ['dumplings']],
  ['Hakka noodles',          'fastfood', '🍜', 250, 190,  5.2, 27.0,  6.8, 2.0, 2.0, 620, ['chowmein']],
  ['Veg fried rice',         'fastfood', '🍚', 250, 163,  3.6, 26.0,  5.0, 1.4, 1.2, 540],
  ['Nachos with cheese',     'fastfood', '🧀', 100, 350,  8.0, 38.0, 19.0, 3.0, 2.0, 640],

  // ── Snacks & sweets ──────────────────────────────────────────────────────
  ['Potato chips',           'snack', '🥔',  30, 536,  7.0, 53.0, 34.0,  4.4,  0.3, 525, ['crisps']],
  ['Namkeen mixture',        'snack', '🥨',  30, 520, 12.0, 45.0, 32.0,  5.0,  3.0, 780, ['bhujia']],
  ['Popcorn',                'snack', '🍿',  25, 387, 12.9, 78.0,  4.5, 14.5,  0.9,   8],
  ['Dark chocolate',         'snack', '🍫',  25, 546,  4.9, 61.0, 31.0,  7.0, 48.0,  24],
  ['Milk chocolate',         'snack', '🍫',  25, 535,  7.6, 59.0, 30.0,  3.4, 52.0,  79],
  ['Vanilla ice cream',      'snack', '🍨',  70, 207,  3.5, 23.6, 11.0,  0.7, 21.0,  80],
  ['Marie biscuit',          'snack', '🍪',  20, 435,  7.0, 75.0, 12.0,  2.0, 20.0, 350, ['tea biscuit']],
  ['Chocolate chip cookie',  'snack', '🍪',  30, 488,  5.6, 64.0, 24.0,  2.4, 36.0, 350],
  ['Glazed donut',           'snack', '🍩',  60, 421,  4.9, 48.0, 23.0,  1.4, 23.0, 380, ['doughnut']],
  ['Croissant',              'snack', '🥐',  60, 406,  8.2, 45.8, 21.0,  2.6, 11.0, 490],
  ['Trail mix',              'snack', '🥜',  40, 462, 13.8, 44.9, 29.4,  5.5, 30.0, 210],
  ['Rice cakes',             'snack', '🍘',  18, 387,  8.2, 81.5,  2.8,  4.2,  0.6,  30],
  ['Protein bar',            'snack', '🍫',  60, 380, 30.0, 40.0, 11.0,  6.0, 12.0, 250],

  // ── Drinks ───────────────────────────────────────────────────────────────
  ['Black coffee',           'drink', '☕', 240,   2, 0.1,  0.3, 0.0, 0.0,  0.0,   2],
  ['Green tea',              'drink', '🍵', 240,   1, 0.0,  0.2, 0.0, 0.0,  0.0,   1],
  ['Masala chai',            'drink', '🍵', 150,  55, 1.4,  8.5, 1.7, 0.0,  8.0,  25, ['tea', 'chai']],
  ['Filter coffee',          'drink', '☕', 150,  65, 1.8,  9.5, 2.0, 0.0,  9.0,  30],
  ['Orange juice',           'drink', '🧃', 250,  45, 0.7, 10.4, 0.2, 0.2,  8.4,   1],
  ['Sugarcane juice',        'drink', '🧃', 250,  74, 0.2, 18.0, 0.1, 0.1, 17.0,   8, ['ganne ka ras']],
  ['Coconut water',          'drink', '🥥', 250,  19, 0.7,  3.7, 0.2, 1.1,  2.6, 105, ['nariyal pani']],
  ['Fresh lime soda',        'drink', '🍋', 250,  38, 0.1,  9.6, 0.0, 0.1,  9.2,  30, ['nimbu pani']],
  ['Cola',                   'drink', '🥤', 330,  42, 0.0, 10.6, 0.0, 0.0, 10.6,   4, ['coke', 'pepsi', 'soft drink']],
  ['Diet cola',              'drink', '🥤', 330,   0, 0.1,  0.1, 0.0, 0.0,  0.0,  10, ['diet coke', 'zero sugar']],
  ['Energy drink',           'drink', '⚡', 250,  45, 0.3, 11.0, 0.0, 0.0, 11.0,  40, ['red bull']],
  ['Mango lassi',            'drink', '🥭', 250, 105, 2.6, 18.0, 2.4, 0.4, 16.0,  40],
  ['Sweet lassi',            'drink', '🥛', 250,  90, 2.8, 14.0, 2.2, 0.0, 13.0,  45],
  ['Beer',                   'drink', '🍺', 330,  43, 0.5,  3.6, 0.0, 0.0,  0.0,   4],
  ['Red wine',               'drink', '🍷', 150,  85, 0.1,  2.6, 0.0, 0.0,  0.6,   4],
]
/* eslint-enable no-multi-spaces */

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const toFood = ([
  name, category, emoji, serving, calories, protein, carbs, fat, fiber, sugar, sodium, aliases = [],
], curated = true) => ({
  id: slugify(name),
  name,
  category,
  emoji,
  serving,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugar,
  sodium,
  aliases,
  curated,
  // Precomputed once so search doesn't re-lowercase 1,300 strings per keystroke.
  haystack: [name, ...aliases, CATEGORIES[category].label].join(' ').toLowerCase(),
})

// The imported rows stop at fibre, so sugar and sodium slot in as null, and
// they are not curated — which search uses to break ties, see below.
const toImportedFood = ([name, category, emoji, serving, calories, protein, carbs, fat, fiber, aliases = []]) =>
  toFood([name, category, emoji, serving, calories, protein, carbs, fat, fiber, null, null, aliases], false)

// Wrapped rather than passed straight to map, which would hand `curated` the
// row index — making the first core food, Apple, the one row that isn't curated.
export const FOODS = [
  ...RAW.map((row) => toFood(row)),
  ...SOUTH_INDIAN_RAW.map((row) => toImportedFood(row)),
]

export const FOOD_COUNT = FOODS.length

const byId = new Map(FOODS.map((food) => [food.id, food]))
export const getFoodById = (id) => byId.get(id) || null

/**
 * Entries store the food's display name, not a foreign key — a log written
 * today must survive this file being edited tomorrow. This looks the food back
 * up for cosmetics only (the emoji on a log row); a miss is harmless.
 */
export const getFoodByName = (name) => (name ? byId.get(slugify(name)) || null : null)

/**
 * Which detail nutrients a day's entries can't fully account for.
 *
 * The imported foods have no sugar or sodium figure, and an entry logged from
 * one contributes zero to those totals. Showing "12g sugar" for a day that
 * included three chutneys would be a number the app can't stand behind, so the
 * card marks the total as a floor instead. A food we can't find (a manual
 * entry) had its numbers typed by hand, so it counts as known.
 */
export function unknownNutrients(entries = []) {
  const unknown = new Set()
  for (const entry of entries) {
    const food = getFoodByName(entry.name)
    if (!food) continue
    if (food.sugar === null) unknown.add('sugar')
    if (food.sodium === null) unknown.add('sodium')
  }
  return unknown
}

/**
 * A small hand-picked shortlist shown before the user types anything —
 * an empty dropdown is a dead end, and "what do people log at 9am" is a
 * better first impression than an alphabetical dump.
 */
export const QUICK_PICKS = [
  'boiled-egg',
  'banana',
  'roti',
  'cooked-white-rice',
  'grilled-chicken-breast',
  'curd',
  'masala-chai',
  'dal-tadka',
]
  .map(getFoodById)
  .filter(Boolean)

/**
 * Search-as-you-type ranking. Deliberately simple and synchronous — even at
 * ~1,350 rows this is a single pass over precomputed lowercase strings, and a
 * debounce plus a fuzzy library would only add latency and bugs.
 *
 * Scoring, highest first:
 *   exact name → name prefix → any word prefix → alias hit → substring anywhere
 *
 * Then two tiebreaks, which the imported list made necessary. Typing "dosa"
 * matches sixty dishes at the same "a word starts with this" tier, and on
 * length alone "Egg dosa" came out above "Plain dosa" — so a curated food
 * outranks an imported one, and a shorter name outranks a longer one. The
 * curated bonus is smaller than the gap between tiers, so it reorders foods
 * that matched equally well and never promotes a worse match.
 */
const CURATED_BONUS = 6
export function searchFoods(query, limit = 8) {
  const q = query.trim().toLowerCase()
  if (!q) return QUICK_PICKS.slice(0, limit)

  const results = []

  for (const food of FOODS) {
    const name = food.name.toLowerCase()
    let score = 0

    if (name === q) score = 100
    else if (name.startsWith(q)) score = 80
    else if (name.split(' ').some((word) => word.startsWith(q))) score = 65
    else if (food.aliases.some((a) => a.toLowerCase().startsWith(q))) score = 55
    else if (food.haystack.includes(q)) score = 35

    if (score > 0) {
      results.push({
        food,
        score: score + (food.curated ? CURATED_BONUS : 0) - name.length * 0.05,
      })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.food)
}
