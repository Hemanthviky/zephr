import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, AlertTriangle, Trash2 } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { CURRENCY, budgetPlan, formatMonthLabel, formatMoney } from '../../utils/expenseMath'

/**
 * The month's budgets: one overall cap, and an optional split beneath it.
 *
 * Built on GoalsPanel's pattern — same sheet, same sticky save footer, same
 * live sanity line at the bottom of the form — so the two settings screens in
 * the app feel like one screen with different fields.
 *
 * The total comes first because it's the decision people actually make ("I've
 * got forty thousand this month"); the categories are how you choose to break
 * it up, and they're allowed to be incomplete. Set neither, one, or both.
 *
 * Budgets are per month by design: leaving a field blank means "no cap this
 * month", not zero.
 */
export default function BudgetsPanel({
  open,
  onClose,
  month,
  categories,
  budgets,
  total = 0,
  spentByCategory,
  monthSpent = 0,
  onSave,
  saving,
  error,
  email,
  name,
  onDeleteCategory,
}) {
  const [draft, setDraft] = useState({})
  const [totalDraft, setTotalDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open && !dirty) {
      setDraft(Object.fromEntries(Object.entries(budgets).map(([id, value]) => [id, String(value)])))
      setTotalDraft(total > 0 ? String(total) : '')
    }
  }, [open, budgets, total, dirty])

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

  // The live plan is computed off the draft, not the saved values, so the
  // summary line at the bottom moves with every keystroke.
  const plan = budgetPlan(
    Object.fromEntries(Object.entries(draft).map(([id, value]) => [id, Number(value) || 0])),
    Number(totalDraft) || 0
  )

  function update(categoryId, value) {
    setDirty(true)
    setDraft((prev) => ({ ...prev, [categoryId]: value }))
  }

  function updateTotal(value) {
    setDirty(true)
    setTotalDraft(value)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await onSave({ categories: draft, total: totalDraft })
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
            className="sheet max-w-[520px] md:max-w-[560px]"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-center gap-3 px-5 pb-3 pt-4">
              <Icon3D name="target" size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold tracking-tight">Budgets</h2>
                <p className="truncate text-xs font-semibold text-ink-400">
                  {formatMonthLabel(month, { short: true })} · {name || email}
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
                {/* ── The overall cap ──────────────────────────────────────
                    Given the same treatment as the amount field in the add
                    form: it's the one number here with no sensible default,
                    and the one most people will set and never revisit. */}
                <div className="rounded-2xl border-2 border-ink-900 bg-lime-100 p-3.5 shadow-press-sm">
                  <label htmlFor="month-total" className="label-caps mb-2 block">
                    Total for {formatMonthLabel(month, { short: true })}
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl font-extrabold text-ink-300"
                      aria-hidden="true"
                    >
                      {CURRENCY.symbol}
                    </span>
                    <input
                      id="month-total"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="No overall cap"
                      value={totalDraft}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateTotal(e.target.value)}
                      className="nums w-full min-h-[64px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 pl-11 pr-4 font-display text-3xl font-extrabold text-ink-900 shadow-inset transition-colors placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:text-ink-300 focus:border-lime-500"
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-snug text-ink-500">
                    {plan.total > 0 ? (
                      <>
                        The ring counts down from this.{' '}
                        <span className="nums">{formatMoney(monthSpent)}</span> spent so far —{' '}
                        <span className="nums font-extrabold text-ink-700">
                          {formatMoney(Math.abs(plan.total - monthSpent))}
                        </span>{' '}
                        {monthSpent > plan.total ? 'over' : 'left'}.
                      </>
                    ) : (
                      'Leave this blank and the ring falls back to whatever the categories below add up to.'
                    )}
                  </p>
                </div>

                <p className="pt-2 text-sm font-medium leading-relaxed text-ink-400">
                  {plan.total > 0
                    ? `Optionally split it up. Leave a category blank and it just isn’t capped — it still counts towards the total above.`
                    : `Set a cap per category for ${formatMonthLabel(month, { short: true })}. Leave one blank and it just won’t count towards your monthly limit.`}
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

                {/* Live reconciliation of the two halves. Over-allocating is a
                    warning, not an error — deciding to overspend on purpose is
                    a real thing to do, and the panel shouldn't block a save
                    over it. */}
                <div
                  className={[
                    'flex items-start gap-2.5 rounded-2xl border-2 p-3 text-sm font-semibold',
                    plan.overAllocated
                      ? 'border-tangerine-500 bg-tangerine-100 text-tangerine-600'
                      : 'border-lime-500 bg-lime-100 text-lime-700',
                  ].join(' ')}
                >
                  <Icon3D
                    name={plan.overAllocated ? 'bulb' : plan.total > 0 || plan.allocated > 0 ? 'sparkles' : 'bulb'}
                    size={20}
                  />
                  <span>
                    {plan.total > 0 ? (
                      plan.capped === 0 ? (
                        <>
                          <strong className="nums">{formatMoney(plan.total)}</strong> for the month,
                          not split up. The ring counts down from it either way.
                        </>
                      ) : plan.overAllocated ? (
                        <>
                          Your categories add up to{' '}
                          <strong className="nums">{formatMoney(plan.allocated)}</strong> — that’s{' '}
                          <strong className="nums">
                            {formatMoney(plan.allocated - plan.total)}
                          </strong>{' '}
                          more than the total above. The ring still counts down from the total.
                        </>
                      ) : (
                        <>
                          <strong className="nums">{formatMoney(plan.allocated)}</strong> of{' '}
                          <strong className="nums">{formatMoney(plan.total)}</strong> split across{' '}
                          {plan.capped} {plan.capped === 1 ? 'category' : 'categories'} —{' '}
                          <strong className="nums">{formatMoney(plan.unallocated)}</strong>{' '}
                          unallocated.
                        </>
                      )
                    ) : plan.allocated > 0 ? (
                      <>
                        <strong className="nums">{formatMoney(plan.allocated)}</strong> budgeted
                        across {plan.capped} {plan.capped === 1 ? 'category' : 'categories'} — with
                        no total set, that’s the number the ring counts down from.
                      </>
                    ) : (
                      'Nothing capped yet. Without a total or any category budgets, the ring falls back to income minus spending for the month.'
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
