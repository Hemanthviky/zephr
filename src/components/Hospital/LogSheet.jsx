import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Minus, Plus, X } from 'lucide-react'
import ItemSelect from './ItemSelect'
import TimeField from './TimeField'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import {
  DRINKS,
  MED_FORMS,
  MED_UNITS,
  ML_PRESETS,
  UNIT_META,
  getDrink,
  getMedForm,
} from '../../data/hospitalItems'
import { formatDose, hmFromISO, isoAt, nowHM } from '../../utils/hospitalMath'
import { formatDayLabel } from '../../utils/dateHelpers'

/**
 * The one sheet behind both charts, in both directions: add a drink, add a
 * medicine, or edit either one after it's saved.
 *
 * Editing reuses the add form rather than getting a stripped-down "quick edit"
 * of its own. A correction is nearly always to the same three things you just
 * typed — what it was, how much, and when — so the screen that asks for them is
 * the screen that should ask again.
 */
export default function LogSheet({
  open,
  onClose,
  kind: initialKind = 'drink',
  editing = null,
  date,
  onSubmit,
  saving = false,
  error,
  medSuggestions = [],
}) {
  const [kind, setKind] = useState(initialKind)
  const [item, setItem] = useState('water')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('200')
  const [unit, setUnit] = useState('ml')
  const [time, setTime] = useState(nowHM)
  const [note, setNote] = useState('')

  const isEdit = Boolean(editing)

  // Fill the form on the way in: from the row being edited, or from the clock
  // and the catalogue's typical serving for a fresh one. A sheet left mounted
  // since breakfast must not still be offering 08:15 at dinner.
  useEffect(() => {
    if (!open) return

    if (editing) {
      setKind(editing.kind)
      setItem(editing.item ?? (editing.kind === 'med' ? 'other' : 'other'))
      setName(editing.name ?? '')
      setAmount(String(Number(editing.amount) || ''))
      setUnit(editing.unit ?? 'ml')
      setTime(hmFromISO(editing.at))
      setNote(editing.note ?? '')
      return
    }

    const drink = DRINKS[0]
    const form = MED_FORMS[0]
    setKind(initialKind)
    setItem(initialKind === 'med' ? form.id : drink.id)
    setName(initialKind === 'med' ? '' : drink.name)
    setAmount(String(initialKind === 'med' ? form.typical : drink.typical))
    setUnit(initialKind === 'med' ? form.unit : 'ml')
    setTime(nowHM())
    setNote('')
  }, [open, editing, initialKind])

  // Escape closes; the page behind stops scrolling while the sheet is up.
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

  const isMed = kind === 'med'
  const catalogue = isMed ? MED_FORMS : DRINKS
  const chosen = isMed ? getMedForm(item) : getDrink(item)
  const meta = UNIT_META[unit] ?? UNIT_META.unit

  // A drink names itself unless it's the "something else" row; a medicine is
  // always named by hand, because no catalogue knows what's on the label.
  const needsTypedName = isMed || chosen?.custom
  const finalName = (needsTypedName ? name : chosen?.name ?? name).trim()

  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= meta.max
  const nameValid = finalName.length > 0 && finalName.length <= 80
  const canSave = amountValid && nameValid && Boolean(time)

  const options = useMemo(
    () =>
      catalogue.map((entry) => ({
        id: entry.id,
        name: entry.name,
        icon: entry.icon,
        tint: entry.tint,
        meta: isMed
          ? `Usually ${formatDose(entry.typical, entry.unit)}`
          : entry.custom
            ? 'Type the name yourself'
            : `Usually ${entry.typical} ml`,
      })),
    [catalogue, isMed]
  )

  function chooseKind(next) {
    if (next === kind) return
    const source = next === 'med' ? MED_FORMS[0] : DRINKS[0]
    setKind(next)
    setItem(source.id)
    setName(next === 'med' ? '' : source.name)
    setAmount(String(source.typical))
    setUnit(next === 'med' ? source.unit : 'ml')
  }

  function chooseItem(option) {
    setItem(option.id)
    const source = isMed ? getMedForm(option.id) : getDrink(option.id)
    if (!source) return

    if (isMed) {
      setUnit(source.unit)
      setAmount(String(source.typical))
      return
    }

    // A drink carries its own name and its own tumbler size. "Something else"
    // keeps whatever was typed, so switching to it and back doesn't wipe it.
    if (!source.custom) setName(source.name)
    setAmount(String(source.typical))
    setUnit('ml')
  }

  function applySuggestion(suggestion) {
    setName(suggestion.name)
    if (suggestion.item && getMedForm(suggestion.item)) setItem(suggestion.item)
    if (suggestion.unit) setUnit(suggestion.unit)
    if (Number.isFinite(suggestion.amount) && suggestion.amount > 0) {
      setAmount(String(suggestion.amount))
    }
  }

  function step(direction) {
    const current = Number.isFinite(parsedAmount) ? parsedAmount : 0
    const next = Math.min(meta.max, Math.max(meta.step, current + direction * meta.step))
    setAmount(String(Number(next.toFixed(1))))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSave || saving) return

    const ok = await onSubmit({
      date,
      kind,
      item: chosen?.id ?? null,
      name: finalName,
      amount: Number(parsedAmount.toFixed(1)),
      unit,
      note: note.trim() ? note.trim().slice(0, 200) : null,
      at: isoAt(date, time),
    })
    if (ok) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        // Above the tab bar (z-50), which is a later sibling in App and would
        // otherwise paint over this sheet's submit button on a phone.
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
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
            aria-label={isEdit ? 'Edit chart entry' : isMed ? 'Log a medicine' : 'Log a drink'}
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
              <Icon3D name={isMed ? 'pill' : 'droplet'} size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-extrabold tracking-tight">
                  {isEdit ? 'Edit this entry' : isMed ? 'Medicine given' : 'Fluid taken'}
                </h2>
                <p className="truncate text-xs font-bold text-ink-400">
                  {formatDayLabel(date)}’s chart
                </p>
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
              {/* Which chart this row lands on. Fixed while editing — moving a
                  dose onto the fluid chart is never a correction, it's a new
                  entry and a deleted one. */}
              {!isEdit && (
                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1.5">
                  {[
                    { id: 'drink', label: 'Drink', icon: 'droplet' },
                    { id: 'med', label: 'Medicine', icon: 'pill' },
                  ].map((option) => {
                    const active = kind === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseKind(option.id)}
                        aria-pressed={active}
                        className={[
                          'tactile flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 font-display text-sm font-extrabold transition-colors',
                          active
                            ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                            : 'border-transparent text-ink-400 hover:bg-cream-50',
                        ].join(' ')}
                      >
                        <Icon3D name={option.icon} size={20} />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Medicine name first: it's the thing you're least sure you
                  remembered, and the form below follows from it. */}
              {isMed && (
                <div className="mb-5">
                  <label htmlFor="med-name" className="label-caps mb-2 block">
                    Which medicine
                  </label>
                  <input
                    id="med-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    placeholder="e.g. Paracetamol 650"
                    autoComplete="off"
                    className="w-full min-h-[56px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-bold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                  />

                  {medSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="label-caps mb-1.5">Given before</p>
                      <div className="flex flex-wrap gap-1.5">
                        {medSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.name}
                            type="button"
                            onClick={() => applySuggestion(suggestion)}
                            className="tactile inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-pill border-2 border-ink-900/15 bg-cream-50 px-3 text-xs font-extrabold hover:border-ink-900/40"
                          >
                            <span className="truncate">{suggestion.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-5">
                <ItemSelect
                  id={isMed ? 'med-form' : 'drink-item'}
                  label={isMed ? 'What form' : 'What did they drink'}
                  options={options}
                  value={item}
                  onChange={chooseItem}
                  placeholder={isMed ? 'Pick a form' : 'Pick a drink'}
                />
              </div>

              {/* A one-off drink still needs a name of its own — the chart says
                  what was in the cup, not "something else". */}
              {!isMed && chosen?.custom && (
                <div className="mb-5">
                  <label htmlFor="drink-name" className="label-caps mb-2 block">
                    Call it what?
                  </label>
                  <input
                    id="drink-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    placeholder="e.g. Barley water"
                    autoComplete="off"
                    className="w-full min-h-[56px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-bold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                  />
                </div>
              )}

              {/* ── How much ─────────────────────────────────────────────── */}
              <div className="mb-5">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="label-caps">{isMed ? 'Dose' : 'How much'}</span>
                  <span className="text-xs font-bold text-ink-400">
                    {amountValid ? formatDose(parsedAmount, unit) : `up to ${meta.max} ${meta.plural}`}
                  </span>
                </div>

                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Less"
                    className="tactile flex h-[76px] w-[56px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-cream-50 shadow-press-sm"
                  >
                    <Minus className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" />
                  </button>

                  <div className="relative min-w-0 flex-1">
                    <input
                      id="chart-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={meta.max}
                      step={meta.half ? 0.5 : 1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      onFocus={(event) => event.target.select()}
                      aria-label={isMed ? 'Dose amount' : 'Millilitres'}
                      className={[
                        'nums h-[76px] w-full rounded-2xl border-[2.5px] bg-cream-50 px-5 pr-[5.5rem] font-display text-4xl font-extrabold text-ink-900 shadow-inset transition-colors',
                        amountValid ? 'border-ink-900/15 focus:border-lime-500' : 'border-coral-500',
                      ].join(' ')}
                    />
                    <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-display text-lg font-extrabold text-ink-300">
                      {meta.plural}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="More"
                    className="tactile flex h-[76px] w-[56px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm"
                  >
                    <Plus className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" />
                  </button>
                </div>

                {!amountValid && (
                  <p className="mt-2 text-sm font-semibold text-coral-600">
                    Give me a number between 0 and {meta.max}.
                  </p>
                )}

                {/* The ward's tumblers, one tap each. */}
                {!isMed && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {ML_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        aria-pressed={parsedAmount === preset}
                        className={[
                          'tactile nums inline-flex min-h-[36px] items-center rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors',
                          parsedAmount === preset
                            ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                            : 'border-ink-900/15 bg-cream-50 hover:border-ink-900/40',
                        ].join(' ')}
                      >
                        {preset} ml
                      </button>
                    ))}
                  </div>
                )}

                {/* Units only matter for medicine — a drink is millilitres, and
                    offering nine alternatives would just be a way to get it
                    wrong. */}
                {isMed && (
                  <div className="mt-2.5">
                    <p className="label-caps mb-1.5">Measured in</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MED_UNITS.map((option) => {
                        const active = unit === option
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setUnit(option)}
                            aria-pressed={active}
                            className={[
                              'tactile inline-flex min-h-[36px] items-center rounded-pill border-2 px-3.5 text-xs font-extrabold transition-colors',
                              active
                                ? 'border-ink-900 bg-lime-400 shadow-press-sm'
                                : 'border-ink-900/15 bg-cream-50 hover:border-ink-900/40',
                            ].join(' ')}
                          >
                            {UNIT_META[option].plural}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── When ─────────────────────────────────────────────────── */}
              <div className="mb-5">
                <TimeField value={time} onChange={setTime} label={isMed ? 'Given at' : 'Taken at'} />
              </div>

              <div>
                <label htmlFor="chart-note" className="label-caps mb-2 block">
                  Note <span className="normal-case tracking-normal text-ink-300">· optional</span>
                </label>
                <input
                  id="chart-note"
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={200}
                  placeholder={isMed ? 'After food, left arm…' : 'Sipped slowly, felt nauseous…'}
                  className="w-full min-h-[52px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-50 px-4 text-base font-semibold text-ink-900 shadow-inset transition-colors placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
                />
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t-2 border-ink-900/10 bg-cream-50 px-5 pt-4 pb-safe"
            >
              {error && (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-coral-500 bg-coral-100 p-2.5 text-sm font-semibold text-coral-600"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                icon={isEdit ? Check : Plus}
                loading={saving}
                disabled={!canSave}
              >
                {saving
                  ? 'Saving…'
                  : !nameValid
                    ? 'Name it first'
                    : !amountValid
                      ? 'Enter an amount'
                      : isEdit
                        ? 'Save changes'
                        : `Log ${formatDose(parsedAmount, unit)}`}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
