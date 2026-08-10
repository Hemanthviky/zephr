import { useState } from 'react'
import { FileDown, Plus, SlidersHorizontal } from 'lucide-react'
import DateNav from './DateNav'
import NutritionLabel from './NutritionLabel'
import FoodLog from './FoodLog'
import AddFoodForm from './AddFoodForm'
import GoalsPanel from '../Settings/GoalsPanel'
import ReportPanel from '../Reports/ReportPanel'
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
 * From `md` — a tablet, or a phone turned sideways — that inverts. A 520px
 * column marooned in the middle of a 1024px window is the clearest sign nobody
 * looked at the screen, so the single scroll splits in two: today's progress
 * parks in a sticky left column that never scrolls out of view, the log gets
 * the wider right column, and the docked button — pointless once there's room
 * for it beside the card — becomes an ordinary button under the progress card.
 *
 * `lg` keeps that split and adds the side rail; `xl` and up just let the two
 * columns breathe rather than stranding the whole app on the left of a 27".
 */
export default function Tracker({ user, onOpenProfile, goalsState }) {
  const [date, setDate] = useState(todayISO)
  const [addOpen, setAddOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

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
      <div className="mx-auto w-full max-w-[540px] px-page pb-dock pt-safe md:max-w-[900px] lg:max-w-[1120px] xl:max-w-[1320px] 2xl:max-w-[1500px]">
        {/* ── Header ──────────────────────────────────────────────────────
            A phone gets the brand mark; anything wider gets the greeting
            instead, which is the better use of a row that has room to spare.
            The avatar stays until lg, where the side rail takes over the
            profile — showing both would put the same face on screen twice. */}
        <header className="flex items-center justify-between gap-3 py-4 md:py-5 lg:py-7">
          <div className="flex items-center gap-2 md:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm">
              <Icon3D name="salad" size={19} />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-[0.18em]">
              Zephr
            </span>
          </div>

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
              {timeGreeting()}, {firstName(user)}.
            </h1>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink-400">
              What you ate, and what it added up to.
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

        {/* Two columns from md: progress sticky on the left, log on the right. */}
        <div className="md:grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
          <div className="md:sticky md:top-4 lg:top-7">
            <div className="mb-5">
              <DateNav date={date} onChange={setDate} entryCount={entries.length} />
            </div>

            <div className="mb-9 md:mb-5">
              <NutritionLabel
                totals={totals}
                goals={goals}
                loading={entriesLoading || goalsLoading}
                entryCount={entries.length}
              />
            </div>

            {/* The primary action, once the layout is wide enough to hold it
                beside the card. The fixed dock below covers everything narrower. */}
            <button
              type="button"
              onClick={openAdd}
              className="tactile hidden min-h-[62px] w-full items-center justify-center gap-3 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-lg font-extrabold shadow-press hover:bg-lime-300 md:flex"
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
          Retired at md, where the same button sits under the progress card.
          On a sideways phone the gradient and the button both come in — that
          strip is a tenth of the screen there. */}
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

      <ReportPanel
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        kind="food"
        userId={user.id}
        userName={displayName(user)}
        userEmail={user.email}
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
