import { useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import DateNav from './DateNav'
import NutritionLabel from './NutritionLabel'
import FoodLog from './FoodLog'
import AddFoodForm from './AddFoodForm'
import GoalsPanel from '../Settings/GoalsPanel'
import Icon3D from '../shared/Icon3D'
import { IconButton } from '../shared/Button'
import { useEntries } from '../../hooks/useEntries'
import { useGoals } from '../../hooks/useGoals'
import { todayISO } from '../../utils/dateHelpers'

/**
 * The signed-in app.
 *
 * Layout is mobile-first and thumb-first: the header and date nav sit at the
 * top where they're read, and the one action you take twenty times a day —
 * logging food — is docked to the bottom of the screen where a thumb rests.
 */
export default function Tracker({ user, onSignOut }) {
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

  const {
    goals,
    loading: goalsLoading,
    saving: goalsSaving,
    error: goalsError,
    saveGoals,
  } = useGoals(user.id)

  function openAdd() {
    dismissError()
    setAddOpen(true)
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-dock pt-safe">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm">
              <Icon3D name="salad" size={19} />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-[0.18em]">
              Zephr
            </span>
          </div>

          <IconButton
            icon={SlidersHorizontal}
            label="Daily goals and account"
            size="sm"
            onClick={() => setGoalsOpen(true)}
          />
        </header>

        <div className="mb-5">
          <DateNav date={date} onChange={setDate} entryCount={entries.length} />
        </div>

        <div className="mb-9">
          <NutritionLabel
            totals={totals}
            goals={goals}
            loading={entriesLoading || goalsLoading}
            entryCount={entries.length}
          />
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

      {/* ── Bottom dock: the primary action, always within thumb reach ───
          Offset by the height of the shared TabBar so the two never overlap. */}
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
        onSignOut={onSignOut}
      />
    </div>
  )
}
