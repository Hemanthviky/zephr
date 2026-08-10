import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, LogOut, AlertTriangle, Trash2 } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { CURRENCY, formatMonthLabel, formatMoney, totalBudget } from '../../utils/expenseMath'

/**
 * Per-category monthly budgets.
 *
 * Built on GoalsPanel's pattern — same sheet, same sticky save footer, same
 * live sanity line at the bottom of the form — so the two settings screens in
 * the app feel like one screen with different fields.
 *
 * Budgets are per month by design: leaving a category blank means "no cap this
 * month", not zero.
 */
export default function BudgetsPanel({
  open,
  onClose,
  month,
  categories,
  budgets,
  spentByCategory,
  onSave,
  saving,
  error,
  email,
  onSignOut,
  onDeleteCategory,
}) {
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open && !dirty) {
      setDraft(Object.fromEntries(Object.entries(budgets).map(([id, value]) => [id, String(value)])))
    }
  }, [open, budgets, dirty])

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

  const total = totalBudget(
    Object.fromEntries(Object.entries(draft).map(([id, value]) => [id, Number(value) || 0]))
  )
  const capped = Object.values(draft).filter((value) => Number(value) > 0).length

  function update(categoryId, value) {
    setDirty(true)
    setDraft((prev) => ({ ...prev, [categoryId]: value }))
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
            aria-label="Close budgets"
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Monthly budgets"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-t-[2rem] border-x-2 border-t-2 border-ink-900 bg-cream-100 shadow-lift sm:rounded-[2rem] sm:border-2"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-center gap-3 px-5 pb-3 pt-4">
              <Icon3D name="target" size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold tracking-tight">Budgets</h2>
                <p className="truncate text-xs font-semibold text-ink-400">
                  {formatMonthLabel(month, { short: true })} · {email}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close budgets"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
                <p className="text-sm font-medium leading-relaxed text-ink-400">
                  Set a cap per category for {formatMonthLabel(month, { short: true })}. Leave one
                  blank and it just won’t count towards your monthly limit.
                </p>

                {categories.map((category) => {
                  const spent = spentByCategory[category.id] ?? 0
                  const value = draft[category.id] ?? ''
                  const cap = Number(value) || 0
                  const over = cap > 0 && spent > cap

                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-2.5"
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2"
                        style={{ borderColor: `${category.color}55`, background: `${category.color}22` }}
                        aria-hidden="true"
                      >
                        <Icon3D name={category.icon || 'receipt'} size={24} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-extrabold leading-tight">
                          {category.name}
                        </p>
                        <p
                          className={`nums mt-0.5 text-xs font-bold ${
                            over ? 'text-coral-600' : 'text-ink-400'
                          }`}
                        >
                          {formatMoney(spent)} spent
                          {cap > 0 && ` · ${over ? 'over by' : 'left'} ${formatMoney(Math.abs(cap - spent))}`}
                        </p>
                      </div>

                      {!category.is_default && onDeleteCategory && (
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(category.id)}
                          aria-label={`Delete ${category.name} category`}
                          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-ink-300 hover:bg-coral-100 hover:text-coral-600"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                        </button>
                      )}

                      <div className="relative w-[104px] shrink-0">
                        <span
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display text-sm font-extrabold text-ink-300"
                          aria-hidden="true"
                        >
                          {CURRENCY.symbol}
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="—"
                          value={value}
                          aria-label={`${category.name} monthly budget`}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => update(category.id, e.target.value)}
                          className="nums w-full min-h-[46px] rounded-xl border-2 border-ink-900/15 bg-cream-100 pl-7 pr-2 text-right font-display text-base font-extrabold shadow-inset focus:border-lime-500"
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="flex items-start gap-2.5 rounded-2xl border-2 border-lime-500 bg-lime-100 p-3 text-sm font-semibold text-lime-700">
                  <Icon3D name={total > 0 ? 'sparkles' : 'bulb'} size={20} />
                  <span>
                    {total > 0 ? (
                      <>
                        <strong className="nums">{formatMoney(total)}</strong> budgeted across{' '}
                        {capped} {capped === 1 ? 'category' : 'categories'} — that’s the number the
                        ring counts down from.
                      </>
                    ) : (
                      'No caps set yet. Without budgets, the ring falls back to income minus spending for the month.'
                    )}
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

                <div className="border-t-2 border-dashed border-ink-900/10 pt-4">
                  <p className="label-caps mb-2">Account</p>
                  <Button variant="ghost" size="sm" icon={LogOut} fullWidth onClick={onSignOut}>
                    Log out
                  </Button>
                </div>
              </div>

              <div className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe">
                <Button type="submit" size="lg" fullWidth icon={Save} loading={saving}>
                  {saving ? 'Saving…' : 'Save budgets'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
