import { useState } from 'react'
import { FileDown, Plus } from 'lucide-react'
import DateNav from '../Tracker/DateNav'
import ChartSummary from './ChartSummary'
import ChartTimeline from './ChartTimeline'
import LogSheet from './LogSheet'
import ReportPanel from '../Reports/ReportPanel'
import Icon3D from '../shared/Icon3D'
import Logo from '../shared/Logo'
import Avatar from '../shared/Avatar'
import { IconButton } from '../shared/Button'
import { useHospitalLog, useFluidTarget } from '../../hooks/useHospitalLog'
import { firstName, displayName } from '../../hooks/useAuth'
import { todayISO } from '../../utils/dateHelpers'

/**
 * The Intake module — a ward chart for someone who's being looked after.
 *
 * Same skeleton as Food and Money (header, date navigator, sticky summary on
 * the left, the record on the right), because anyone who has used the other two
 * already knows where everything is. What's different is what the record *is*:
 * a fluid balance chart and a drug chart, on one timeline, where the time of day
 * is the point rather than a footnote — so the summary is a drip bag, the log is
 * a rail with a clock down its left edge, and every entry stays editable long
 * after it's saved.
 *
 * Two primary actions rather than one, since "drink" and "medicine" are equally
 * common and burying one behind a toggle inside the sheet would make it the
 * second-class half of the module.
 */
export default function Hospital({ user, onOpenProfile }) {
  const [date, setDate] = useState(todayISO)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKind, setSheetKind] = useState('drink')
  const [editing, setEditing] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)

  const {
    rows,
    meds,
    totals,
    medSuggestions,
    loading,
    saving,
    error,
    addLog,
    updateLog,
    deleteLog,
    refresh,
    dismissError,
  } = useHospitalLog(user.id, date)

  const { target, saveTarget } = useFluidTarget(user.id)

  function openAdd(kind = 'drink') {
    dismissError()
    setEditing(null)
    setSheetKind(kind)
    setSheetOpen(true)
  }

  function openEdit(row) {
    dismissError()
    setEditing(row)
    setSheetKind(row.kind)
    setSheetOpen(true)
  }

  async function handleSubmit(draft) {
    return editing ? updateLog(editing.id, draft) : addLog(draft)
  }

  return (
    <div className="min-h-[100dvh] lg:pl-[248px]">
      <div className="mx-auto w-full max-w-[540px] px-page pb-dock pt-safe md:max-w-[900px] lg:max-w-[1120px] xl:max-w-[1320px] 2xl:max-w-[1500px]">
        <header className="flex items-center justify-between gap-3 py-4 md:py-5 lg:py-7">
          <Logo size={34} className="md:hidden" />

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
              The chart, {firstName(user)}.
            </h1>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink-400">
              Every drink and every dose, with the time it happened.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              icon={FileDown}
              label="Download a report"
              size="sm"
              onClick={() => setReportOpen(true)}
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

        <div className="md:grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
          <div className="md:sticky md:top-4 lg:top-7">
            <div className="mb-5">
              <DateNav date={date} onChange={setDate} entryCount={rows.length} />
            </div>

            <div className="mb-9 md:mb-5">
              <ChartSummary
                totals={totals}
                target={target}
                onTargetChange={saveTarget}
                loading={loading}
                medCount={meds.length}
              />
            </div>

            {/* Both actions, inline, once the layout is wide enough to hold them
                beside the card. The fixed dock below covers everything narrower. */}
            <div className="hidden gap-2 md:grid md:grid-cols-2">
              <button
                type="button"
                onClick={() => openAdd('drink')}
                className="tactile flex min-h-[62px] items-center justify-center gap-2 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-base font-extrabold shadow-press hover:bg-lime-300"
              >
                <Plus className="h-5 w-5" strokeWidth={3.25} aria-hidden="true" />
                Drink
                <Icon3D name="droplet" size={24} />
              </button>
              <button
                type="button"
                onClick={() => openAdd('med')}
                className="tactile flex min-h-[62px] items-center justify-center gap-2 rounded-[1.25rem] border-[3px] border-ink-900 bg-cream-50 font-display text-base font-extrabold shadow-press hover:bg-cream-100"
              >
                <Plus className="h-5 w-5" strokeWidth={3.25} aria-hidden="true" />
                Medicine
                <Icon3D name="pill" size={24} />
              </button>
            </div>
          </div>

          <ChartTimeline
            rows={rows}
            loading={loading}
            error={error}
            date={date}
            onEdit={openEdit}
            onDelete={deleteLog}
            onRetry={refresh}
            onAdd={openAdd}
          />
        </div>
      </div>

      {/* Bottom dock, offset by the height of the shared TabBar. Two buttons
          here rather than one, split the way the chart itself is. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-40 md:hidden">
        <div className="h-16 bg-gradient-to-t from-cream-100 via-cream-100/90 to-transparent short:h-8" />
        <div className="bg-cream-100 pb-3 short:pb-2">
          <div className="mx-auto grid w-full max-w-[540px] grid-cols-2 gap-2 px-page">
            <button
              type="button"
              onClick={() => openAdd('drink')}
              className="tactile pointer-events-auto flex min-h-[62px] items-center justify-center gap-2 rounded-[1.25rem] border-[3px] border-ink-900 bg-lime-400 font-display text-base font-extrabold shadow-press hover:bg-lime-300 short:min-h-[52px] short:text-sm"
            >
              <Plus className="h-5 w-5" strokeWidth={3.25} aria-hidden="true" />
              Drink
              <Icon3D name="droplet" size={22} />
            </button>
            <button
              type="button"
              onClick={() => openAdd('med')}
              className="tactile pointer-events-auto flex min-h-[62px] items-center justify-center gap-2 rounded-[1.25rem] border-[3px] border-ink-900 bg-cream-50 font-display text-base font-extrabold shadow-press hover:bg-cream-100 short:min-h-[52px] short:text-sm"
            >
              <Plus className="h-5 w-5" strokeWidth={3.25} aria-hidden="true" />
              Medicine
              <Icon3D name="pill" size={22} />
            </button>
          </div>
        </div>
      </div>

      <ReportPanel
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        kind="intake"
        userId={user.id}
        userName={displayName(user)}
        userEmail={user.email}
      />

      <LogSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditing(null)
        }}
        kind={sheetKind}
        editing={editing}
        date={date}
        onSubmit={handleSubmit}
        saving={saving}
        error={sheetOpen ? error : null}
        medSuggestions={medSuggestions}
      />
    </div>
  )
}
