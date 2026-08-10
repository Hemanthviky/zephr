import { forwardRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Check, X, Pencil } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import { formatMoney } from '../../utils/expenseMath'
import { formatDayLabel } from '../../utils/dateHelpers'
import { walletIcon, UNCATEGORISED } from '../../data/defaultCategories'

/**
 * One transaction.
 *
 * Structurally the food tracker's LogEntryRow: icon tile, two lines of detail,
 * the number on the right, and a two-tap delete confirmed on the row itself.
 * The row body is the edit affordance — tapping the thing you want to change is
 * more obvious than hunting a pencil at 390px wide.
 *
 * forwardRef because the list is an `AnimatePresence mode="popLayout"`, which
 * measures each leaving child through a ref on the direct child.
 */
const ExpenseEntryRow = forwardRef(function ExpenseEntryRow(
  { transaction, category, wallet, onEdit, onDelete, index = 0 },
  ref
) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isPending = String(transaction.id).startsWith('optimistic-')
  const income = transaction.type === 'income'
  const meta = category ?? UNCATEGORISED

  async function handleDelete() {
    setDeleting(true)
    const ok = await onDelete(transaction.id)
    if (!ok) {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -60, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(index * 0.03, 0.2) }}
      className="relative overflow-hidden rounded-2xl border-2 border-ink-900/10 bg-cream-50 shadow-card"
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          disabled={isPending}
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-wait"
          aria-label={`Edit ${meta.name}${transaction.note ? `, ${transaction.note}` : ''}`}
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2"
            style={{ borderColor: `${meta.color}55`, background: `${meta.color}22` }}
            aria-hidden="true"
          >
            <Icon3D name={meta.icon || 'receipt'} size={26} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[0.95rem] font-extrabold leading-tight">
              {transaction.note?.trim() || meta.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-400">
              {wallet && (
                <>
                  <Icon3D name={walletIcon(wallet.name)} size={13} />
                  <span className="truncate">{wallet.name}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="truncate">
                {transaction.note?.trim() ? meta.name : formatDayLabel(transaction.date)}
              </span>
            </span>
          </span>
        </button>

        <div className="shrink-0 text-right">
          <p
            className={`nums font-display text-base font-extrabold leading-none ${
              income ? 'text-lime-700' : 'text-ink-900'
            }`}
          >
            {income ? '+' : ''}
            {formatMoney(transaction.amount)}
          </p>
          <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-300">
            {isPending ? 'saving' : formatDayLabel(transaction.date)}
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onEdit(transaction)}
            disabled={isPending}
            aria-label={`Edit ${meta.name}`}
            className="flex h-11 w-9 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-cream-200 hover:text-ink-900 disabled:opacity-30"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.75} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending}
            aria-label={`Delete ${meta.name}`}
            className="flex h-11 w-9 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-coral-100 hover:text-coral-600 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.75} />
          </button>
        </div>
      </div>

      {confirming && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 flex items-center justify-between gap-2 bg-coral-100 px-3"
        >
          <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-coral-600">
            Delete {formatMoney(transaction.amount)}?
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
            aria-label="Confirm delete"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Yes
          </button>
        </motion.div>
      )}
    </motion.li>
  )
})

export default ExpenseEntryRow
