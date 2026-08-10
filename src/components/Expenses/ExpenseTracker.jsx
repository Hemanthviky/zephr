import { useMemo, useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import MonthNav from './MonthNav'
import BudgetSummary from './BudgetSummary'
import SpendingChart from './SpendingChart'
import TrendChart from './TrendChart'
import ExpenseLog from './ExpenseLog'
import AddExpenseForm from './AddExpenseForm'
import WalletPicker from './WalletPicker'
import BudgetsPanel from './BudgetsPanel'
import Icon3D from '../shared/Icon3D'
import { IconButton } from '../shared/Button'
import { useTransactions, TREND_MONTHS } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { useWallets } from '../../hooks/useWallets'
import { useBudgets } from '../../hooks/useBudgets'
import {
  currentMonth,
  lastNMonths,
  monthlyTotals,
  sumTransactions,
  totalsByCategory,
} from '../../utils/expenseMath'

/**
 * The Money module.
 *
 * Deliberately the same skeleton as Tracker.jsx: header, period navigator, hero
 * progress card, then the detail, with the primary action docked at the bottom
 * of the screen above the tab bar. Anyone who has used the Food tab already
 * knows where everything is.
 */
export default function ExpenseTracker({ user, onSignOut }) {
  const [month, setMonth] = useState(currentMonth)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [budgetsOpen, setBudgetsOpen] = useState(false)
  const [walletFilter, setWalletFilter] = useState(null)

  const {
    transactions,
    history,
    loading: txLoading,
    saving,
    error: txError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refresh,
    dismissError,
  } = useTransactions(user.id, month)

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    addCategory,
    deleteCategory,
  } = useCategories(user.id)

  const {
    wallets,
    defaultWallet,
    loading: walletsLoading,
    addWallet,
  } = useWallets(user.id)

  const {
    budgets,
    loading: budgetsLoading,
    saving: budgetsSaving,
    error: budgetsError,
    saveBudgets,
  } = useBudgets(user.id, month)

  // Charts and the hero card always describe the whole month; only the log is
  // filtered, right below the picker that filters it.
  const categoryTotals = useMemo(
    () => totalsByCategory(transactions, categories, budgets),
    [transactions, categories, budgets]
  )

  const trendSeries = useMemo(
    () => monthlyTotals(history, lastNMonths(month, TREND_MONTHS)),
    [history, month]
  )

  const visibleTransactions = useMemo(
    () => (walletFilter ? transactions.filter((tx) => tx.wallet_id === walletFilter) : transactions),
    [transactions, walletFilter]
  )

  const spentByCategory = useMemo(
    () => Object.fromEntries(categoryTotals.map((c) => [c.id, c.total])),
    [categoryTotals]
  )

  const monthTotals = sumTransactions(transactions)
  const loadingShell = txLoading || budgetsLoading

  function openAdd() {
    dismissError()
    setEditing(null)
    setAddOpen(true)
  }

  function openEdit(transaction) {
    dismissError()
    setEditing(transaction)
    setAddOpen(true)
  }

  async function handleSubmit(draft) {
    return editing ? updateTransaction(editing.id, draft) : addTransaction(draft)
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-dock pt-safe">
        <header className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm">
              <Icon3D name="moneywings" size={19} />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-[0.18em]">
              Money
            </span>
          </div>

          <IconButton
            icon={SlidersHorizontal}
            label="Budgets and account"
            size="sm"
            onClick={() => setBudgetsOpen(true)}
          />
        </header>

        <div className="mb-5">
          <MonthNav month={month} onChange={setMonth} transactionCount={transactions.length} />
        </div>

        <div className="mb-9">
          <BudgetSummary
            transactions={transactions}
            budgets={budgets}
            categories={categories}
            categoryTotals={categoryTotals}
            month={month}
            loading={loadingShell}
          />
        </div>

        <div className="mb-5">
          <SpendingChart
            categoryTotals={categoryTotals}
            total={monthTotals.expense}
            loading={loadingShell}
          />
        </div>

        <div className="mb-9">
          <TrendChart series={trendSeries} loading={txLoading} />
        </div>

        {wallets.length > 1 && (
          <div className="mb-4">
            <p className="label-caps mb-2 px-1">Wallet · filters the list below</p>
            <WalletPicker
              wallets={wallets}
              value={walletFilter}
              onChange={setWalletFilter}
              includeAll
              loading={walletsLoading}
            />
          </div>
        )}

        <ExpenseLog
          transactions={visibleTransactions}
          categories={categories}
          wallets={wallets}
          loading={txLoading}
          error={txError || categoriesError}
          month={month}
          onEdit={openEdit}
          onDelete={deleteTransaction}
          onRetry={refresh}
          onAdd={openAdd}
        />
      </div>

      {/* Primary action, docked above the tab bar. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-40">
        <div className="h-16 bg-gradient-to-t from-cream-100 via-cream-100/90 to-transparent" />
        <div className="bg-cream-100 pb-3">
          <div className="mx-auto w-full max-w-[520px] px-4">
            <button
              type="button"
              onClick={openAdd}
              className="tactile pointer-events-auto flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300"
            >
              <Plus className="h-6 w-6" strokeWidth={3.25} aria-hidden="true" />
              Add expense
              <Icon3D name="receipt" size={26} />
            </button>
          </div>
        </div>
      </div>

      <AddExpenseForm
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        editing={editing}
        categories={categories}
        wallets={wallets}
        defaultWallet={defaultWallet}
        onCreateCategory={addCategory}
        onCreateWallet={addWallet}
        saving={saving}
        error={addOpen ? txError : null}
        loadingOptions={categoriesLoading || walletsLoading}
      />

      <BudgetsPanel
        open={budgetsOpen}
        onClose={() => setBudgetsOpen(false)}
        month={month}
        categories={categories}
        budgets={budgets}
        spentByCategory={spentByCategory}
        onSave={saveBudgets}
        saving={budgetsSaving}
        error={budgetsError}
        email={user.email}
        onSignOut={onSignOut}
        onDeleteCategory={deleteCategory}
      />
    </div>
  )
}
