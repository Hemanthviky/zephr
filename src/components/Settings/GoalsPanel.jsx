import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, AlertTriangle, Wand2, ChevronRight } from 'lucide-react'
import Button from '../shared/Button'
import Input from '../shared/Input'
import Icon3D from '../shared/Icon3D'
import { MACRO_META, MACROS, round0 } from '../../utils/nutritionMath'

/**
 * Daily goals editor.
 *
 * Macros are entered in grams (that's what the bars measure), but people think
 * in calories — so the panel shows, live, how many calories the four fields add
 * up to and whether that matches the calorie goal. The split presets rewrite
 * the macro grams from the calorie goal so nobody has to do 4/4/9 by hand.
 */


const SPLIT_PRESETS = [
  { id: 'balanced', label: 'Balanced', hint: '30/40/30', split: { protein: 0.3, carbs: 0.4, fat: 0.3 } },
  { id: 'protein', label: 'High protein', hint: '40/30/30', split: { protein: 0.4, carbs: 0.3, fat: 0.3 } },
  { id: 'lowcarb', label: 'Low carb', hint: '35/20/45', split: { protein: 0.35, carbs: 0.2, fat: 0.45 } },
]

export default function GoalsPanel({
  open,
  onClose,
  goals,
  onSave,
  saving,
  error,
  email,
  name,
  onOpenProfile,
}) {
  const [draft, setDraft] = useState(goals)
  const [dirty, setDirty] = useState(false)

  // Re-seed the form whenever it opens, or when goals arrive from the server
  // after a slow fetch — but never clobber edits the user is mid-way through.
  useEffect(() => {
    if (open && !dirty) setDraft(goals)
  }, [open, goals, dirty])

  useEffect(() => {
    if (!open) {
      setDirty(false)
      return
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  const macroCalories =
    round0(draft.protein) * 4 + round0(draft.carbs) * 4 + round0(draft.fat) * 9
  const drift = macroCalories - round0(draft.calories)
  const aligned = Math.abs(drift) <= 60 // a rounding-sized gap, not a mistake

  function update(key, value) {
    setDirty(true)
    setDraft((prev) => ({ ...prev, [key]: value === '' ? '' : Number(value) }))
  }

  function applyPreset(preset) {
    const kcal = Number(draft.calories) || 2000
    setDirty(true)
    // Spread, don't replace: the draft also carries the body stats, and a
    // rebuilt object would send nulls for all of them on the next save.
    setDraft((prev) => ({
      ...prev,
      calories: kcal,
      protein: Math.round((kcal * preset.split.protein) / 4),
      carbs: Math.round((kcal * preset.split.carbs) / 4),
      fat: Math.round((kcal * preset.split.fat) / 9),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await onSave(draft)
    if (ok) {
      setDirty(false)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close settings"
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Daily goals"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="sheet max-w-[520px] md:max-w-[560px]"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-center gap-3 px-5 pb-3 pt-4">
              <Icon3D name="target" size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold tracking-tight">Daily goals</h2>
                <p className="truncate text-xs font-semibold text-ink-400">{name || email}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
                {/* Body stats live in the profile, not here — they describe you,
                    not your targets, and one home for them means no two screens
                    can disagree about your weight. */}
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="tactile flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 border-ink-900/15 bg-cream-50 px-3 text-left hover:border-ink-900/35"
                >
                  <Icon3D name="scale" size={26} />
                  <span className="min-w-0 flex-1 text-sm font-bold text-ink-700">
                    Work these out from your height and weight
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" strokeWidth={3} />
                </button>

                <Input
                  label="Calories per day"
                  type="number"
                  inputMode="numeric"
                  min="500"
                  max="10000"
                  suffix="kcal"
                  value={draft.calories}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => update('calories', e.target.value)}
                  className="font-display text-xl"
                />

                <div>
                  <p className="label-caps mb-2">Start from a split</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SPLIT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="tactile min-h-[52px] rounded-xl border-2 border-ink-900/15 bg-cream-50 px-1 text-xs font-extrabold text-ink-700 transition-colors hover:border-ink-900/35"
                      >
                        <Wand2 className="mx-auto mb-1 h-3.5 w-3.5 text-ink-400" strokeWidth={3} />
                        {preset.label}
                        <span className="mt-0.5 block text-[0.6rem] font-bold text-ink-300">
                          {preset.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {MACROS.map((macro) => (
                    <div key={macro}>
                      <span
                        className="mb-1.5 block h-1.5 w-8 rounded-pill"
                        style={{ background: MACRO_META[macro].ring }}
                        aria-hidden="true"
                      />
                      <Input
                        label={MACRO_META[macro].label}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="1000"
                        suffix="g"
                        value={draft[macro]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => update(macro, e.target.value)}
                        className="font-display"
                      />
                    </div>
                  ))}
                </div>

                {/* Live sanity check on the arithmetic. */}
                <div
                  className={[
                    'flex items-start gap-2.5 rounded-2xl border-2 p-3 text-sm font-semibold',
                    aligned
                      ? 'border-lime-500 bg-lime-100 text-lime-700'
                      : 'border-tangerine-500 bg-tangerine-100 text-tangerine-600',
                  ].join(' ')}
                >
                  <Icon3D name={aligned ? 'sparkles' : 'bulb'} size={20} />
                  <span>
                    Your macros add up to <strong className="nums">{macroCalories} kcal</strong>
                    {aligned
                      ? ' — that lines up with your calorie goal.'
                      : ` — that's ${Math.abs(drift)} ${drift > 0 ? 'above' : 'below'} your calorie goal. Fine if it's deliberate.`}
                  </span>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                    <span>{error}</span>
                  </div>
                )}

              </div>

              <div className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe">
                <Button type="submit" size="lg" fullWidth icon={Save} loading={saving}>
                  {saving ? 'Saving…' : 'Save goals'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
