import { useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import DateNav from './DateNav'
import NutritionLabel from './NutritionLabel'
import FoodLog from './FoodLog'
import AddFoodForm from './AddFoodForm'
import GoalsPanel from '../Settings/GoalsPanel'
import Icon3D from '../shared/Icon3D'
import Avatar from '../shared/Avatar'
import { IconButton } from '../shared/Button'
import { useEntries } from '../../hooks/useEntries'
import { firstName, displayName } from '../../hooks/useAuth'
import { todayISO, timeGreeting } from '../../utils/dateHelpers'

/**
 * The signed-in app.
 *
 * Mobile-first and thumb-first: header and date nav at the top where they're
 * read, and the one action you take twenty times a day — logging food — docked
 * to the bottom of the screen where a thumb rests.
 *
 * From `lg` up that inverts. A phone column stretched across a desktop window
 * is a waste of the screen, so the single scroll splits into two: today's
 * progress parks in a sticky left column that never scrolls out of view, the
 * log gets the wider right column, and the docked button — pointless when the
 * pointer is mid-screen — becomes an ordinary button under the progress card.
 */
export default function Tracker({ user, onOpenProfile, goalsState }) {
  const [date, setDate] = useState(todayISO)
  const [addOpen, setAddOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const {
    entries,
    totals,
    loading: entriesLoading,
    saving,
    error: entriesError,
    addEntry,
    deleteEntry,
    refresh,
    dismissError,
  } = useEntries(user.id, date)

  // Goals are owned by App and shared with the profile panel, which edits the
  // body stats behind them — two useGoals instances would silently diverge the
  // moment either one saved.
  const {
    goals,
    loading: goalsLoading,
    saving: goalsSaving,
    error: goalsError,
    saveGoals,
  } = goalsState

  function openAdd() {
    dismissError()
    setAddOpen(true)
  }

  return (
    <div className="min-h-[100dvh] lg:pl-[248px]">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-dock pt-safe lg:max-w-[1120px] lg:px-10">
        {/* ── Header ──────────────────────────────────────────────────────
            The brand mark lives in the sidebar on desktop, so here it only
            shows below lg — otherwise it'd be on screen twice. */}
        <header className="flex items-center justify-between gap-3 py-4 lg:py-7">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm">
              <Icon3D name="salad" size={19} />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-[0.18em]">
              Zephr
            </span>
          </div>

          <div className="hidden min-w-0 lg:block">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {timeGreeting()}, {firstName(user)}.
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-ink-400">
              What you ate, and what it added up to.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              icon={SlidersHorizontal}
              label="Daily goals"
              size="sm"
              onClick={() => setGoalsOpen(true)}
            />

            {/* Phone-only: the desktop rail already carries a full profile row,
                so showing it here too would put the same avatar on screen twice. */}
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

        {/* Two columns from lg: progress sticky on the left, log on the right. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-9">
          <div className="lg:sticky lg:top-7">
            <div className="mb-5">
              <DateNav date={date} onChange={setDate} entryCount={entries.length} />
            </div>

            <div className="mb-9 lg:mb-5">
              <NutritionLabel
                totals={totals}
                goals={goals}
                loading={entriesLoading || goalsLoading}
                entryCount={entries.length}
              />
            </div>

            {/* Desktop's primary action. The fixed dock below covers mobile. */}
            <button
              type="button"
              onClick={openAdd}
              className="tactile hidden min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300 lg:flex"
            >
              <Plus className="h-6 w-6" strokeWidth={3.25} aria-hidden="true" />
              Log food
              <Icon3D name="plate" size={26} />
            </button>
          </div>

          <FoodLog
            entries={entries}
            totals={totals}
            loading={entriesLoading}
            error={entriesError}
            date={date}
            onDelete={deleteEntry}
            onRetry={refresh}
            onAdd={openAdd}
          />
        </div>
      </div>

      {/* ── Bottom dock: the primary action, always within thumb reach ───
          Offset by the height of the shared TabBar so the two never overlap.
          Retired at lg, where the same button sits under the progress card. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-40 lg:hidden">
        <div className="h-16 bg-gradient-to-t from-cream-100 via-cream-100/90 to-transparent" />
        <div className="bg-cream-100 pb-3">
          <div className="mx-auto w-full max-w-[520px] px-4">
            <button
              type="button"
              onClick={openAdd}
              className="tactile pointer-events-auto flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300"
            >
              <Plus className="h-6 w-6" strokeWidth={3.25} aria-hidden="true" />
              Log food
              <Icon3D name="plate" size={26} />
            </button>
          </div>
        </div>
      </div>

      <AddFoodForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addEntry}
        saving={saving}
        error={addOpen ? entriesError : null}
      />

      <GoalsPanel
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        goals={goals}
        onSave={saveGoals}
        saving={goalsSaving}
        error={goalsError}
        email={user.email}
        name={displayName(user)}
        onOpenProfile={() => {
          setGoalsOpen(false)
          onOpenProfile?.()
        }}
      />
    </div>
  )
}
