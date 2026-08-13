import { lazy, Suspense, useMemo, useState } from 'react'
import { FileDown, Plus, SlidersHorizontal } from 'lucide-react'
import MonthNav from './MonthNav'
import BudgetSummary from './BudgetSummary'
import ExpenseLog from './ExpenseLog'
import AddExpenseForm from './AddExpenseForm'
import WalletPicker from './WalletPicker'
import BudgetsPanel from './BudgetsPanel'
import ReportPanel from '../Reports/ReportPanel'
import Icon3D from '../shared/Icon3D'
import Logo from '../shared/Logo'
import Avatar from '../shared/Avatar'
import { IconButton } from '../shared/Button'
import { useTransactions, TREND_MONTHS } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { useWallets } from '../../hooks/useWallets'
import { useBudgets } from '../../hooks/useBudgets'
import { firstName, displayName } from '../../hooks/useAuth'
import { timeGreeting } from '../../utils/dateHelpers'
import {
  currentMonth,
  lastNMonths,
  monthlyTotals,
  sumTransactions,
  totalsByCategory,
} from '../../utils/expenseMath'

// recharts is ~400KB, and it's the only thing in this tab that big. Splitting
// the two charts out of the tab's own chunk means opening Money paints the
// month's numbers — which is what you came for — without waiting on a charting
// library first. The charts arrive a beat later, into space already reserved
// for them.
const SpendingChart = lazy(() => import('./SpendingChart'))
const TrendChart = lazy(() => import('./TrendChart'))

/**
 * What sits in the charts' place while their chunk is in flight.
 *
 * These are the same skeletons the two components render for `loading`, on
 * purpose: the shapes have to match or the grid resizes twice — once when the
 * chunk lands, again when the data does.
 */
function ChartsFallback() {
  return (
    <>
      <div className="card p-5">
        <div className="skeleton mx-auto aspect-square w-full max-w-[190px] rounded-full sm:max-w-[220px]" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
      </div>
      <div className="card p-5">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-4 h-[180px] w-full rounded-2xl sm:h-[210px]" />
      </div>
    </>
  )
}

/**
 * The Money module.
 *
 * Deliberately the same skeleton as Tracker.jsx: header, period navigator, hero
 * progress card, then the detail, with the primary action docked at the bottom
 * of the screen above the tab bar. Anyone who has used the Food tab already
 * knows where everything is.
 */
export default function ExpenseTracker({ user, onOpenProfile }) {
  const [month, setMonth] = useState(currentMonth)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [budgetsOpen, setBudgetsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
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
    total: budgetTotal,
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
    <div className="min-h-[100dvh] lg:pl-[248px]">
      <div className="mx-auto w-full max-w-[540px] px-page pb-dock pt-safe md:max-w-[900px] lg:max-w-[1120px] xl:max-w-[1320px] 2xl:max-w-[1500px]">
        <header className="flex items-center justify-between gap-3 py-4 md:py-5 lg:py-7">
          <Logo size={34} className="md:hidden" />

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
              {timeGreeting()}, {firstName(user)}.
            </h1>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink-400">
              What you spent, and what’s left of the month.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              icon={FileDown}
              label="Download a report"
              size="sm"
              onClick={() => setReportOpen(true)}
            />

            <IconButton
              icon={SlidersHorizontal}
              label="Budgets"
              size="sm"
              onClick={() => setBudgetsOpen(true)}
            />

            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label="Your profile"
                className="tactile rounded-2xl lg:hidden"
              >
                <Avatar name={displayName(user)} size={44} />
              </button>
            )}
          </div>
        </header>

        {/* Same two-column split as the Food tab: the month's headline sticks
            on the left, the charts and ledger take the wider right column. */}
        <div className="md:grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
          <div className="md:sticky md:top-4 lg:top-7">
            <div className="mb-5">
              <MonthNav month={month} onChange={setMonth} transactionCount={transactions.length} />
            </div>

            <div className="mb-9 md:mb-5">
              <BudgetSummary
                transactions={transactions}
                budgets={budgets}
                budgetTotal={budgetTotal}
                categoryTotals={categoryTotals}
                month={month}
                loading={loadingShell}
              />
            </div>

            <button
              type="button"
              onClick={openAdd}
              className="tactile hidden min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300 md:flex"
            >
              <Plus className="h-6 w-6" strokeWidth={3.25} aria-hidden="true" />
              Add expense
              <Icon3D name="receipt" size={26} />
            </button>
          </div>

          <div className="min-w-0">
            {/* Charts stack until the right column can give each of them a real
                width. That's later than it looks: the left column and the rail
                have already taken ~630px off the window by then. */}
            <div className="mb-9 grid gap-5 2xl:grid-cols-2">
              {/* One boundary, not two: both charts come out of the same
                  recharts chunk, so splitting them would only stagger the two
                  halves of a grid that should land together. */}
              <Suspense fallback={<ChartsFallback />}>
                <SpendingChart
                  categoryTotals={categoryTotals}
                  total={monthTotals.expense}
                  loading={loadingShell}
                />
                <TrendChart series={trendSeries} loading={txLoading} />
              </Suspense>
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
        </div>
      </div>

      {/* Primary action, docked above the tab bar. Phones only — from md the
          same button sits under the summary card. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-40 md:hidden">
        <div className="h-16 bg-gradient-to-t from-cream-100 via-cream-100/90 to-transparent short:h-8" />
        <div className="bg-cream-100 pb-3 short:pb-2">
          <div className="mx-auto w-full max-w-[540px] px-page">
            <button
              type="button"
              onClick={openAdd}
              className="tactile pointer-events-auto flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300 short:min-h-[52px] short:text-base"
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

      <ReportPanel
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        kind="money"
        userId={user.id}
        userName={displayName(user)}
        userEmail={user.email}
      />

      <BudgetsPanel
        open={budgetsOpen}
        onClose={() => setBudgetsOpen(false)}
        month={month}
        categories={categories}
        budgets={budgets}
        total={budgetTotal}
        spentByCategory={spentByCategory}
        monthSpent={monthTotals.expense}
        onSave={saveBudgets}
        saving={budgetsSaving}
        error={budgetsError}
        email={user.email}
        name={displayName(user)}
        onDeleteCategory={deleteCategory}
      />
    </div>
  )
}
