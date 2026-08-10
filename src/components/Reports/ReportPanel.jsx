import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Download, FileText, RefreshCw, X } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import { useReportData } from '../../hooks/useReportData'
import { REPORT_KINDS, buildReport } from '../../utils/reportBuilders'
import {
  RANGE_PRESETS,
  buildCSV,
  buildReportHTML,
  downloadCSV,
  downloadHTML,
  formatRangeLabel,
  openReport,
  rangeFor,
  reportFilename,
} from '../../utils/reports'
import { todayISO } from '../../utils/dateHelpers'

/**
 * Reports — one sheet, three modules.
 *
 * Same panel for Food, Money and Hospital, because the question is identical
 * in all three ("give me this range, on paper") and only the columns differ.
 * What changes per module lives in utils/reportBuilders.js, so adding a fourth
 * report is a table name and a builder, not another screen.
 *
 * Presets first, custom dates second. Nobody opens this wanting to type two
 * dates — they want last week, or last month, or the whole admission — and the
 * two fields are there for the one time in ten that they don't.
 *
 * Nothing is fetched until the sheet is opened: it's mounted beside every
 * module, and a report panel that quietly pulls a year of history on page load
 * would be the most expensive thing in the app.
 */
export default function ReportPanel({ open, onClose, kind, userId, userName = '', userEmail = '' }) {
  const config = REPORT_KINDS[kind]

  const [preset, setPreset] = useState('last7')
  const [from, setFrom] = useState(() => rangeFor('last7').from)
  const [to, setTo] = useState(() => rangeFor('last7').to)
  // Set only when a browser refuses the report's tab, so the sheet can explain
  // where the file went instead.
  const [blocked, setBlocked] = useState(false)

  // Re-resolve the preset every time the sheet opens: a tab left open overnight
  // would otherwise still think "last 7 days" ends yesterday.
  useEffect(() => {
    if (!open || preset === 'custom') return
    const next = rangeFor(preset)
    setFrom(next.from)
    setTo(next.to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  const range = useMemo(() => ({ from, to }), [from, to])
  const { rows, extras, loading, error, refresh } = useReportData(kind, userId, range, open)

  const report = useMemo(
    () => buildReport(kind, rows, extras, range),
    [kind, rows, extras, range]
  )

  const rangeLabel = formatRangeLabel(from, to)

  // `interactive` adds the on-screen "Save as PDF" bar and the auto-print — right
  // for a tab that exists to be printed, wrong for a file someone saved to keep,
  // which shouldn't ambush them with a print dialog every time they open it.
  const html = (interactive) =>
    buildReportHTML({
      title: report.title,
      subtitle: report.subtitle,
      rangeLabel,
      userName,
      userEmail,
      summary: report.summary,
      columns: report.columns,
      rows,
      groups: report.groups,
      accent: report.accent,
      interactive,
    })

  /**
   * A tab of its own, which is the only place a page can print itself on a
   * phone. If the browser blocks it, save the same page instead and say so —
   * a button that appears to do nothing is worse than one that does something
   * slightly different.
   */
  function openPDF() {
    if (openReport(html(true))) {
      setBlocked(false)
      return
    }
    downloadHTML(reportFilename(kind, from, to, 'html'), html(false))
    setBlocked(true)
  }

  function choosePreset(id) {
    setPreset(id)
    const next = rangeFor(id)
    setFrom(next.from)
    setTo(next.to)
  }

  /**
   * Editing either date drops you into a custom range, and keeps from ≤ to.
   *
   * The ISO check is for the browsers with no native date control (Safari
   * before 14.1, older Firefox), where the field degrades to a text box and can
   * hand back half-typed nonsense on every keystroke.
   */
  function editFrom(value) {
    if (!isISODate(value)) return
    setPreset('custom')
    setFrom(value)
    if (value > to) setTo(value)
  }

  function editTo(value) {
    if (!isISODate(value)) return
    setPreset('custom')
    setTo(value)
    if (value < from) setFrom(value)
  }

  const empty = !loading && rows.length === 0

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
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
            aria-label={`${config.label} report`}
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
              <Icon3D name={config.icon} size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-extrabold tracking-tight">
                  {config.label} report
                </h2>
                <p className="truncate text-xs font-bold text-ink-400">{config.blurb}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {/* ── Presets ───────────────────────────────────────────────── */}
              <p className="label-caps mb-2">Period</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {RANGE_PRESETS.map((option) => {
                  const active = preset === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => choosePreset(option.id)}
                      aria-pressed={active}
                      className={[
                        'tactile min-h-[42px] rounded-xl border-2 px-2 font-display text-xs font-extrabold transition-colors',
                        active
                          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                          : 'border-ink-900/15 bg-cream-50 text-ink-500 hover:border-ink-900/40',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              {/* ── Custom range ──────────────────────────────────────────── */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <DateField id="report-from" label="From" value={from} max={to} onChange={editFrom} />
                <DateField id="report-to" label="To" value={to} min={from} max={todayISO()} onChange={editTo} />
              </div>

              <p className="mt-2 text-xs font-bold text-ink-400">
                {preset === 'custom' ? 'Custom range · ' : ''}
                {rangeLabel}
              </p>

              {/* ── What's in it ──────────────────────────────────────────── */}
              <div className="mt-5 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="label-caps">In this report</span>
                  <span className="nums text-xs font-extrabold text-ink-400">
                    {loading ? 'counting…' : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
                  </span>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 rounded-xl border-2 border-coral-500 bg-coral-100 p-2.5"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-coral-600" strokeWidth={2.75} />
                    <p className="min-w-0 flex-1 text-xs font-semibold text-coral-600">{error}</p>
                    <Button size="xs" variant="secondary" icon={RefreshCw} onClick={refresh}>
                      Retry
                    </Button>
                  </div>
                ) : loading ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-[52px] rounded-xl" />
                    ))}
                  </div>
                ) : empty ? (
                  <p className="py-3 text-center text-sm font-semibold text-ink-400">
                    Nothing was logged in this period. Pick a wider one.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {report.summary.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border-2 border-ink-900/10 bg-cream-50 px-2.5 py-2"
                      >
                        <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-400">
                          {item.label}
                        </dt>
                        <dd className="nums truncate font-display text-base font-extrabold leading-tight">
                          {item.value}
                        </dd>
                        {item.hint && (
                          <dd className="truncate text-[0.6rem] font-bold text-ink-300">
                            {item.hint}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              <p className="mt-3 text-xs font-medium leading-relaxed text-ink-400">
                <strong className="font-extrabold text-ink-500">CSV</strong> opens in Excel or
                Sheets — one row per entry, ready to sort.{' '}
                <strong className="font-extrabold text-ink-500">PDF</strong> opens the laid-out
                report in a new tab and offers the print dialog; pick “Save as PDF” there.
              </p>

              {blocked && (
                <p
                  role="status"
                  className="mt-3 rounded-2xl border-2 border-ink-900/15 bg-cream-200 p-3 text-xs font-semibold leading-relaxed text-ink-500"
                >
                  Your browser blocked the new tab, so the report was{' '}
                  <strong className="font-extrabold">downloaded as a file</strong> instead. Open it
                  from your downloads and print from there — or allow pop-ups for this site and try
                  again.
                </p>
              )}
            </div>

            <div className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe">
              <div className="flex gap-2">
                <Button
                  size="lg"
                  icon={Download}
                  className="flex-1"
                  disabled={loading || empty || Boolean(error)}
                  onClick={() =>
                    downloadCSV(
                      reportFilename(kind, from, to, 'csv'),
                      buildCSV(report.columns, rows)
                    )
                  }
                >
                  CSV
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  icon={FileText}
                  className="flex-1"
                  disabled={loading || empty || Boolean(error)}
                  onClick={openPDF}
                >
                  PDF
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** 'YYYY-MM-DD', and a real day — '2026-13-40' matches the shape and isn't one. */
function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/**
 * `type="date"` degrades to a text input where it isn't supported, so the
 * placeholder and pattern aren't decoration — they're the entire interface on
 * Safari before 14.1. The value format is identical either way.
 */
function DateField({ id, label, value, min, max, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="label-caps mb-1.5 block">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        placeholder="YYYY-MM-DD"
        pattern="\d{4}-\d{2}-\d{2}"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        className="nums h-[52px] w-full rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-3 font-display text-sm font-extrabold text-ink-900 shadow-inset transition-colors focus:border-lime-500"
      />
    </div>
  )
}
