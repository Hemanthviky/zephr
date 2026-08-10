import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Pencil, X } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import { fillRatio, formatClock, formatMl, sinceLabel } from '../../utils/hospitalMath'

/**
 * The head of the chart: fluid balance, then the drug round.
 *
 * The gauge is a drip bag rather than the ring the Food tab uses, and that's
 * deliberate — this module is a different kind of record, and a second identical
 * ring would invite reading it as calories. A bag empties downward, fills
 * upward, and is the object the number on it actually describes.
 *
 * The target is per-device and per-user (see useFluidTarget): a fluid
 * restriction is set on a ward round, not in a settings panel, so it's editable
 * right here on the card that reports against it.
 */
export default function ChartSummary({
  totals,
  target,
  onTargetChange,
  loading = false,
  medCount = 0,
}) {
  const ratio = fillRatio(totals.ml, target)
  const percent = Math.round(ratio * 100)
  const left = Math.max(0, Math.round(target - totals.ml))
  const over = totals.ml > target
  const reduceMotion = useReducedMotion()

  if (loading) return <SummarySkeleton />

  return (
    <section className="card overflow-hidden" aria-label="Fluid and medicine summary">
      {/* Chart header strip — the printed band at the top of a ward chart. */}
      <div className="flex items-center justify-between gap-2 border-b-2 border-dashed border-ink-900/15 bg-cream-200 px-4 py-2.5">
        <span className="label-caps">Fluid balance</span>
        <TargetEditor value={target} onChange={onTargetChange} />
      </div>

      <div className="flex items-stretch gap-4 p-4">
        {/* ── The bag ──────────────────────────────────────────────────── */}
        <div className="flex w-[76px] shrink-0 flex-col items-center">
          {/* Hanger and drip line. Decoration, but it's what makes the shape
              read as a bag rather than a battery. */}
          <span className="h-2 w-6 rounded-t-md border-2 border-b-0 border-ink-900 bg-cream-200" aria-hidden="true" />

          <div
            className="relative h-[168px] w-[62px] overflow-hidden rounded-[1.1rem] border-[3px] border-ink-900 bg-cream-200 shadow-press-sm"
            role="img"
            aria-label={`${formatMl(totals.ml)} of ${formatMl(target)} millilitres, ${percent}%`}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(ratio * 100, totals.ml > 0 ? 6 : 0)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              style={{
                background: over
                  ? 'linear-gradient(180deg, #FF9E85 0%, #FF5A38 100%)'
                  : 'linear-gradient(180deg, #6FD9C2 0%, #12B39A 100%)',
              }}
            >
              {/* Meniscus — a lighter band at the surface of the liquid. */}
              <span className="absolute inset-x-0 top-0 h-1.5 bg-cream-50/60" aria-hidden="true" />
            </motion.div>

            {/* Graduation marks, every quarter of the target. */}
            {[25, 50, 75].map((mark) => (
              <span
                key={mark}
                className="absolute right-0 h-[2px] w-3 bg-ink-900/25"
                style={{ bottom: `${mark}%` }}
                aria-hidden="true"
              />
            ))}

            <span className="nums absolute inset-x-0 top-2 text-center text-[0.6rem] font-extrabold text-ink-700/70">
              {percent}%
            </span>
          </div>

          {/* A drop on its way down, when there's still room in the bag. */}
          {!reduceMotion && !over && (
            <motion.span
              className="mt-1 h-2 w-2 rounded-full bg-avocado-500"
              animate={{ y: [0, 6, 0], opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* ── The reading ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="nums font-display text-[clamp(2.2rem,9vw,2.8rem)] font-extrabold leading-none tracking-tight">
            {formatMl(totals.ml)}
            <span className="ml-1.5 font-sans text-base font-bold text-ink-400">ml</span>
          </p>

          <p className="mt-1.5 text-sm font-bold text-ink-500">
            {over ? (
              <span className="text-coral-600">{formatMl(totals.ml - target)} ml over the limit</span>
            ) : totals.ml === 0 ? (
              'Nothing on the chart yet'
            ) : (
              <>
                <span className="nums">{formatMl(left)} ml</span> to go
              </>
            )}
          </p>

          <div className="mt-3 h-2.5 overflow-hidden rounded-pill border-2 border-ink-900/10 bg-cream-200">
            <motion.div
              className="h-full rounded-pill"
              initial={{ width: 0 }}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              style={{ background: over ? '#FF5A38' : '#12B39A' }}
            />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Drinks" value={totals.drinks} />
            <Stat
              label="Last one"
              value={totals.lastDrinkAt ? formatClock(totals.lastDrinkAt) : '—'}
              sub={totals.lastDrinkAt ? sinceLabel(totals.lastDrinkAt) : null}
            />
          </dl>
        </div>
      </div>

      {/* ── The drug round ───────────────────────────────────────────────
          Same card, hard rule between them: a chart keeps fluids and drugs on
          one sheet, and separating them into two cards would hide the thing
          you look at them together for. */}
      <div className="flex items-center gap-3 border-t-2 border-dashed border-ink-900/15 bg-cream-100 px-4 py-3">
        <Icon3D name="pill" size={30} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold leading-tight">
            {medCount === 0
              ? 'No medicine logged'
              : `${medCount} ${medCount === 1 ? 'dose' : 'doses'} given`}
          </p>
          <p className="truncate text-xs font-bold text-ink-400">
            {totals.lastMedAt
              ? `Last at ${formatClock(totals.lastMedAt)} · ${sinceLabel(totals.lastMedAt)}`
              : 'Log one as it goes in'}
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border-2 border-ink-900/10 bg-cream-100 px-2.5 py-2">
      <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </dt>
      <dd className="nums truncate font-display text-base font-extrabold leading-tight">{value}</dd>
      {sub && <dd className="truncate text-[0.6rem] font-bold text-ink-300">{sub}</dd>}
    </div>
  )
}

/** The day's fluid allowance — one tap to change, because ward rounds do. */
function TargetEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tactile inline-flex min-h-[32px] items-center gap-1.5 rounded-pill border-2 border-ink-900/15 bg-cream-50 px-2.5 text-xs font-extrabold hover:border-ink-900/40"
      >
        <span className="nums">target {formatMl(value)} ml</span>
        <Pencil className="h-3 w-3 text-ink-400" strokeWidth={3} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <label htmlFor="fluid-target" className="sr-only">
        Daily fluid target in millilitres
      </label>
      <input
        id="fluid-target"
        type="number"
        min="200"
        max="8000"
        step="50"
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setEditing(false)
        }}
        className="nums h-9 w-[86px] rounded-xl border-2 border-ink-900 bg-cream-50 px-2 text-sm font-extrabold shadow-inset"
      />
      <button
        type="button"
        onClick={commit}
        aria-label="Save target"
        className="tactile flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-900 bg-lime-400 shadow-press-sm"
      >
        <Check className="h-4 w-4" strokeWidth={3.5} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-300"
      >
        <X className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <section className="card overflow-hidden" aria-busy="true" aria-label="Loading chart summary">
      <div className="border-b-2 border-dashed border-ink-900/15 bg-cream-200 px-4 py-3">
        <div className="skeleton h-3 w-28" />
      </div>
      <div className="flex items-stretch gap-4 p-4">
        <div className="skeleton h-[178px] w-[62px] rounded-[1.1rem]" />
        <div className="flex-1 space-y-3 py-2">
          <div className="skeleton h-9 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-2.5 w-full rounded-pill" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    </section>
  )
}
