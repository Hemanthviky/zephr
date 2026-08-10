import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, Plus, AlertTriangle } from 'lucide-react'
import FoodSearchDropdown from './FoodSearchDropdown'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { CATEGORIES } from '../../data/foodDatabase'
import { MACRO_META, MACROS, round0, round1, scaleFood } from '../../utils/nutritionMath'

/**
 * The "log a food" bottom sheet.
 *
 * Two steps, because asking for a food *and* a weight at once is how you get
 * abandoned forms on a phone: pick the food, then confirm the grams (pre-filled
 * with that food's typical serving) while watching the numbers update live.
 */
export default function AddFoodForm({ open, onClose, onAdd, saving = false, error }) {
  const [food, setFood] = useState(null)
  const [grams, setGrams] = useState('')

  const parsedGrams = Number(grams)
  const gramsValid = Number.isFinite(parsedGrams) && parsedGrams > 0 && parsedGrams <= 5000
  const scaled = food && gramsValid ? scaleFood(food, parsedGrams) : null

  // Reset a step behind the closing animation so the sheet doesn't visibly
  // flip back to the search step on its way out.
  useEffect(() => {
    if (open) return
    const timer = setTimeout(() => {
      setFood(null)
      setGrams('')
    }, 260)
    return () => clearTimeout(timer)
  }, [open])

  // Escape closes; the page behind stops scrolling while the sheet is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  function handleSelect(picked) {
    setFood(picked)
    setGrams(String(picked.serving))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!scaled || saving) return

    const ok = await onAdd({
      name: food.name,
      grams: round1(parsedGrams),
      ...scaled,
    })
    if (ok) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={food ? `How much ${food.name}?` : 'Search for a food'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-t-[2rem] border-x-2 border-t-2 border-ink-900 bg-cream-100 shadow-lift sm:rounded-[2rem] sm:border-2"
          >
            {/* Grab handle — signals "this is draggable-ish / dismissible". */}
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-center gap-3 px-5 pb-3 pt-4">
              {food ? (
                <button
                  type="button"
                  onClick={() => setFood(null)}
                  className="tactile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
                  aria-label="Back to search"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={3} />
                </button>
              ) : (
                <Icon3D name="cooking" size={34} />
              )}

              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-extrabold tracking-tight">
                {food ? 'How much?' : 'What did you eat?'}
              </h2>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {food ? (
                <PortionStep
                  food={food}
                  grams={grams}
                  onGramsChange={setGrams}
                  scaled={scaled}
                  gramsValid={gramsValid}
                />
              ) : (
                <FoodSearchDropdown onSelect={handleSelect} autoFocus={open} />
              )}
            </div>

            {food && (
              <form
                onSubmit={handleSubmit}
                className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe"
              >
                {error && (
                  <div
                    role="alert"
                    className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-2.5 text-sm font-semibold text-coral-600"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  icon={Plus}
                  loading={saving}
                  disabled={!gramsValid}
                >
                  {saving
                    ? 'Logging…'
                    : gramsValid
                      ? `Log ${round0(scaled.calories)} kcal`
                      : 'Enter a weight'}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Step 2: the weight dial and a live nutrition preview. */
function PortionStep({ food, grams, onGramsChange, scaled, gramsValid }) {
  // Portion shortcuts beat a slider on mobile: three taps cover most meals.
  const presets = [
    { label: 'Half', value: Math.max(1, Math.round(food.serving / 2)) },
    { label: '1 serving', value: food.serving },
    { label: 'Double', value: food.serving * 2 },
  ]

  return (
    <div className="pb-5">
      {/* Chosen food */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-ink-900 bg-lime-100 p-3 shadow-press-sm">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900/10 bg-cream-50 text-3xl"
          aria-hidden="true"
        >
          {food.emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-extrabold leading-tight">{food.name}</p>
          <p className="text-xs font-semibold text-ink-500">
            {CATEGORIES[food.category].label} · {food.calories} kcal per 100g
          </p>
        </div>
      </div>

      {/* Weight */}
      <label htmlFor="grams-input" className="label-caps mb-2 block">
        Weight
      </label>
      <div className="relative">
        <input
          id="grams-input"
          type="number"
          inputMode="decimal"
          min="1"
          max="5000"
          step="1"
          value={grams}
          onChange={(e) => onGramsChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className={[
            'nums w-full min-h-[76px] rounded-2xl border-[2.5px] bg-cream-50 px-5 pr-20 font-display text-4xl font-extrabold text-ink-900 shadow-inset transition-colors',
            gramsValid ? 'border-ink-900/15 focus:border-lime-500' : 'border-coral-500',
          ].join(' ')}
        />
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-display text-xl font-extrabold text-ink-300">
          grams
        </span>
      </div>

      {!gramsValid && (
        <p className="mt-2 text-sm font-semibold text-coral-600">
          Give me a weight between 1 and 5000 grams.
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {presets.map((preset) => {
          const active = Number(grams) === preset.value
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onGramsChange(String(preset.value))}
              className={[
                'tactile min-h-[46px] rounded-xl border-2 px-2 text-xs font-extrabold transition-colors',
                active
                  ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                  : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/35',
              ].join(' ')}
            >
              {preset.label}
              <span className="mt-0.5 block text-[0.65rem] font-bold text-ink-400">
                {preset.value}g
              </span>
            </button>
          )
        })}
      </div>

      {/* Live preview — the payoff for typing a number. */}
      <div className="mt-5 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-4">
        <div className="flex items-end justify-between">
          <span className="label-caps">That works out to</span>
          <span className="nums font-display text-3xl font-extrabold leading-none">
            {scaled ? round0(scaled.calories) : '—'}
            <span className="ml-1 font-sans text-sm font-bold text-ink-400">kcal</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {MACROS.map((macro) => (
            <div
              key={macro}
              className="rounded-xl border-2 border-ink-900/10 bg-cream-50 px-2 py-2.5 text-center"
            >
              <span
                className="mx-auto mb-1.5 block h-1.5 w-6 rounded-pill"
                style={{ background: MACRO_META[macro].ring }}
                aria-hidden="true"
              />
              <p className="nums font-display text-base font-extrabold leading-none">
                {scaled ? round1(scaled[macro]) : '—'}
                <span className="text-xs text-ink-400">g</span>
              </p>
              <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-ink-400">
                {MACRO_META[macro].label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
