import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Check, X } from 'lucide-react'
import { getFoodByName } from '../../data/foodDatabase'
import { MACRO_META, MACROS, formatGrams, round0, round1 } from '../../utils/nutritionMath'
import { formatTime } from '../../utils/dateHelpers'

/**
 * One logged food.
 *
 * Delete is two taps, confirmed inline on the row itself. A one-tap trash icon
 * next to a 44px touch target deletes things people meant to keep, and a modal
 * for "remove one banana" is far too much ceremony.
 */
function describeServings(grams, serving) {
  if (!serving || !grams) return null

  const count = Number(grams) / serving
  const nearestHalf = Math.round(count * 2) / 2
  if (nearestHalf < 0.5 || nearestHalf > 20) return null
  if (Math.abs(count - nearestHalf) > 0.03) return null

  const label = Number(nearestHalf.toFixed(1)).toString()
  return `${label} ${nearestHalf === 1 ? 'serving' : 'servings'}`
}

export default function LogEntryRow({ entry, onDelete, index = 0 }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const food = getFoodByName(entry.name)
  const isPending = String(entry.id).startsWith('optimistic-')

  // Derived, not stored: entries only keep grams, so a food whose serving size
  // we still recognise gets its count reconstructed. Shown only when it lands
  // on a clean half — "1.37 servings" is noise, not information.
  const servings = describeServings(entry.grams, food?.serving)

  async function handleDelete() {
    setDeleting(true)
    const ok = await onDelete(entry.id)
    // On failure the row comes back, so drop it out of confirm state.
    if (!ok) {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -60, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(index * 0.03, 0.2) }}
      className="relative overflow-hidden rounded-2xl border-2 border-ink-900/10 bg-cream-50 shadow-card"
    >
      <div className="flex items-center gap-3 p-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900/10 bg-cream-100 text-2xl"
          aria-hidden="true"
        >
          {food?.emoji ?? '🍽️'}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.95rem] font-extrabold leading-tight">
            {entry.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-ink-400">
            <span className="nums">
              {formatGrams(entry.grams)}
              {servings && <span className="text-ink-300"> · {servings}</span>}
            </span>
            {MACROS.map((macro) => (
              <span key={macro} className="nums inline-flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: MACRO_META[macro].ring }}
                  aria-hidden="true"
                />
                {round1(entry[macro])}g
              </span>
            ))}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="nums font-display text-lg font-extrabold leading-none">
            {round0(entry.calories)}
          </p>
          <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-300">
            {isPending ? 'saving' : formatTime(entry.created_at) || 'kcal'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          aria-label={`Delete ${entry.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.75} />
        </button>
      </div>

      {/* Confirmation slides over the row rather than replacing it, so the
          thing you're about to delete stays visible underneath. */}
      {confirming && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 flex items-center justify-between gap-2 bg-coral-100 px-3"
        >
          <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-coral-600">
            Delete this?
          </p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="tactile flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
            aria-label="Keep it"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="tactile flex h-11 min-w-[64px] items-center justify-center gap-1 rounded-xl border-2 border-ink-900 bg-coral-500 px-3 font-display text-sm font-extrabold text-cream-50 shadow-press-coral"
            aria-label={`Confirm delete ${entry.name}`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Yes
          </button>
        </motion.div>
      )}
    </motion.li>
  )
}
