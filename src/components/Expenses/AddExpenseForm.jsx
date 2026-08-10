import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Check, AlertTriangle } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import WalletPicker from './WalletPicker'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { CURRENCY } from '../../utils/expenseMath'
import { todayISO } from '../../utils/dateHelpers'

/**
 * Add / edit a transaction.
 *
 * Same bottom-sheet mechanics as AddFoodForm — Escape to close, body scroll
 * locked, spring slide-up — but a single step instead of two: an expense is
 * four decisions (how much, what for, from where, when) and splitting those
 * across screens would be slower than just showing them.
 *
 * The amount field is the first and biggest thing, because it's the only field
 * that has no sensible default.
 */
export default function AddExpenseForm({
  open,
  onClose,
  onSubmit,
  editing = null,
  categories,
  wallets,
  defaultWallet,
  onCreateCategory,
  onCreateWallet,
  saving = false,
  error,
  loadingOptions = false,
}) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO)
  const [touched, setTouched] = useState(false)

  const isEdit = Boolean(editing)
  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const categoryValid = Boolean(categoryId)
  const canSubmit = amountValid && categoryValid && !saving

  // Seed the form each time it opens: the transaction being edited, or a fresh
  // draft defaulted to today and the Cash wallet.
  useEffect(() => {
    if (!open) return

    if (editing) {
      setType(editing.type ?? 'expense')
      setAmount(String(editing.amount ?? ''))
      setCategoryId(editing.category_id ?? null)
      setWalletId(editing.wallet_id ?? defaultWallet?.id ?? null)
      setNote(editing.note ?? '')
      setDate(editing.date ?? todayISO())
    } else {
      setType('expense')
      setAmount('')
      setCategoryId(null)
      setWalletId(defaultWallet?.id ?? null)
      setNote('')
      setDate(todayISO())
    }
    setTouched(false)
  }, [open, editing, defaultWallet])

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

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSubmit) return

    const ok = await onSubmit({
      amount: Math.round(parsedAmount * 100) / 100,
      type,
      category_id: categoryId,
      wallet_id: walletId,
      note: note.trim() || null,
      date,
    })
    if (ok) onClose()
  }

  const income = type === 'income'

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
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
            aria-label={isEdit ? 'Edit transaction' : 'Add transaction'}
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
              <Icon3D name={income ? 'moneybag' : 'receipt'} size={34} />
              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-extrabold tracking-tight">
                {isEdit ? 'Edit entry' : income ? 'Money in' : 'What did you spend?'}
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

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
                {/* Expense / income */}
                <div
                  role="radiogroup"
                  aria-label="Transaction type"
                  className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1"
                >
                  {[
                    ['expense', 'Expense', 'moneywings'],
                    ['income', 'Income', 'banknote'],
                  ].map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={type === id}
                      onClick={() => setType(id)}
                      className={[
                        'flex min-h-[46px] items-center justify-center gap-2 rounded-xl font-display text-sm font-extrabold transition-all duration-150',
                        type === id
                          ? 'border-2 border-ink-900 bg-cream-50 shadow-press-sm'
                          : 'text-ink-400 hover:text-ink-700',
                      ].join(' ')}
                    >
                      <Icon3D name={icon} size={20} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount-input" className="label-caps mb-2 block">
                    Amount
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 font-display text-3xl font-extrabold text-ink-300"
                      aria-hidden="true"
                    >
                      {CURRENCY.symbol}
                    </span>
                    <input
                      id="amount-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={amount}
                      autoFocus={!isEdit}
                      onChange={(e) => setAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={[
                        'nums w-full min-h-[76px] rounded-2xl border-[2.5px] bg-cream-50 pl-14 pr-5 font-display text-4xl font-extrabold text-ink-900 shadow-inset transition-colors placeholder:text-ink-300',
                        touched && !amountValid
                          ? 'border-coral-500'
                          : 'border-ink-900/15 focus:border-lime-500',
                      ].join(' ')}
                    />
                  </div>
                  {touched && !amountValid && (
                    <p className="mt-2 text-sm font-semibold text-coral-600">
                      Enter an amount above zero.
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="label-caps">Category</span>
                    {touched && !categoryValid && (
                      <span className="text-xs font-extrabold text-coral-600">Pick one</span>
                    )}
                  </div>
                  <CategoryPicker
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    onCreate={onCreateCategory}
                    loading={loadingOptions}
                  />
                </div>

                {/* Wallet */}
                <div>
                  <p className="label-caps mb-2">Wallet</p>
                  <WalletPicker
                    wallets={wallets}
                    value={walletId}
                    onChange={setWalletId}
                    onCreate={onCreateWallet}
                    loading={loadingOptions}
                  />
                </div>

                {/* Date + note */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tx-date" className="label-caps mb-2 block">
                      Date
                    </label>
                    <input
                      id="tx-date"
                      type="date"
                      value={date}
                      max={todayISO()}
                      onChange={(e) => setDate(e.target.value || todayISO())}
                      className="nums w-full min-h-[52px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-semibold text-ink-900 shadow-inset focus:border-lime-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="tx-note" className="label-caps mb-2 block">
                      Note <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <input
                      id="tx-note"
                      type="text"
                      value={note}
                      maxLength={200}
                      placeholder="Lunch with Priya"
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full min-h-[52px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-semibold text-ink-900 shadow-inset placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe">
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
                  icon={isEdit ? Check : Plus}
                  loading={saving}
                  disabled={!canSubmit}
                >
                  {saving
                    ? 'Saving…'
                    : isEdit
                      ? 'Save changes'
                      : income
                        ? 'Log income'
                        : 'Log expense'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
