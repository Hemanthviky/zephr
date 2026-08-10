import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import ExpenseEntryRow from './ExpenseEntryRow'
import Icon3D from '../shared/Icon3D'
import Button from '../shared/Button'
import { formatMoney, isCurrentMonth, sumTransactions } from '../../utils/expenseMath'
import { formatDayLabel } from '../../utils/dateHelpers'

/**
 * This month's transactions, newest first, grouped by day.
 *
 * The day header carries that day's net movement, which is the number people
 * actually scan for ("what did Saturday cost me?") — without it a long month is
 * just an undifferentiated column of rows.
 */
export default function ExpenseLog({
  transactions,
  categories,
  wallets,
  loading,
  error,
  month,
  onEdit,
  onDelete,
  onRetry,
  onAdd,
}) {
  const categoryIndex = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const walletIndex = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets])

  // `transactions` already arrives newest first, so insertion order gives us
  // days newest first and rows newest first within each day, for free.
  const days = useMemo(() => {
    const grouped = new Map()
    for (const tx of transactions) {
      if (!grouped.has(tx.date)) grouped.set(tx.date, [])
      grouped.get(tx.date).push(tx)
    }
    return [...grouped.entries()]
  }, [transactions])

  const totals = sumTransactions(transactions)

  return (
    <section aria-label="Transactions">
      <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          {isCurrentMonth(month) ? 'This month' : 'That month'}
        </h2>
        {transactions.length > 0 && (
          <p className="nums shrink-0 text-xs font-bold text-ink-400">
            {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'} ·{' '}
            {formatMoney(totals.expense, { compact: true })} out
          </p>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-coral-600" strokeWidth={2.75} />
          <p className="min-w-0 flex-1 text-sm font-semibold text-coral-600">{error}</p>
          <Button size="xs" variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <LogSkeleton />
      ) : transactions.length === 0 && !error ? (
        <EmptyState month={month} onAdd={onAdd} />
      ) : (
        <div className="space-y-5">
          {days.map(([date, rows]) => {
            const dayTotals = sumTransactions(rows)
            return (
              <div key={date}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <p className="label-caps">{formatDayLabel(date)}</p>
                  <p className="nums text-[0.7rem] font-extrabold text-ink-400">
                    {dayTotals.income > 0 && (
                      <span className="text-lime-700">
                        +{formatMoney(dayTotals.income)}
                        {dayTotals.expense > 0 ? ' · ' : ''}
                      </span>
                    )}
                    {dayTotals.expense > 0 && `−${formatMoney(dayTotals.expense)}`}
                  </p>
                </div>

                <ul className="space-y-2.5">
                  <AnimatePresence initial={false} mode="popLayout">
                    {rows.map((transaction, index) => (
                      <ExpenseEntryRow
                        key={transaction.id}
                        transaction={transaction}
                        category={categoryIndex.get(transaction.category_id)}
                        wallet={walletIndex.get(transaction.wallet_id)}
                        index={index}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function EmptyState({ month, onAdd }) {
  const now = isCurrentMonth(month)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center px-6 py-10 text-center"
    >
      <Icon3D name={now ? 'purse' : 'moon'} size={82} float={now} className="mb-4" />

      <p className="font-display text-lg font-extrabold leading-tight">
        {now ? 'Nothing spent yet' : 'A quiet month'}
      </p>
      <p className="mx-auto mt-2 max-w-[17rem] text-sm font-medium leading-relaxed text-ink-400">
        {now
          ? 'Add your first entry — that chai counts too.'
          : 'No transactions were logged this month. You can still add them retroactively.'}
      </p>

      {now && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onAdd}>
          Log something
        </Button>
      )}
    </motion.div>
  )
}

function LogSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading transactions">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3"
        >
          <div className="skeleton h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-2.5 w-3/4" />
          </div>
          <div className="skeleton h-6 w-14" />
        </div>
      ))}
    </div>
  )
}
