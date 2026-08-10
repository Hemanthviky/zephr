import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Pencil, Check, LogOut, AlertTriangle, Copy, CheckCheck, Mail,
  ChevronRight, ChevronLeft, Save,
} from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import Avatar from '../shared/Avatar'
import Input from '../shared/Input'
import { displayName } from '../../hooks/useAuth'
import {
  ACTIVITY_LEVELS, AIMS, SEXES, bmiOf, canCalculate, calculateTargets,
} from '../../utils/calorieTargets'

/**
 * Profile — two slides.
 *
 *   1. **Card** — who you are. A membership card rather than a form: monogram
 *      punched into a lime band, name in hero type, perforated tear line, join
 *      date printed along the bottom. The only screen in the app whose job is
 *      to be looked at rather than operated.
 *   2. **Body** — height, weight, and the calorie target they imply.
 *
 * Body stats live here rather than in the goals panel because they describe
 * *you*, not your targets — and keeping them in one place means no two screens
 * can disagree about your weight.
 *
 * Nothing here ever rewrites your calorie goal silently. Saving your stats
 * saves your stats; if that changes what the equation suggests, you're asked,
 * and the target only moves on an explicit yes.
 */

const SLIDES = ['card', 'body']

export default function ProfilePanel({
  open,
  onClose,
  user,
  onUpdateName,
  saving = false,
  error,
  onSignOut,
  onClearError,
  goals,
  onSaveGoals,
  goalsSaving = false,
  goalsError,
}) {
  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (!open) {
      setSlide(0)
      setDirection(1)
      return
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  function goTo(next) {
    if (next === slide || next < 0 || next >= SLIDES.length) return
    setDirection(next > slide ? 1 : -1)
    setSlide(next)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close profile"
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your profile"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="sheet max-w-[460px] overflow-hidden"
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-11 rounded-pill bg-ink-900/15" />
            </div>

            <header className="flex items-center gap-2 px-5 pb-3 pt-4">
              <h2 className="min-w-0 flex-1 font-display text-xl font-extrabold tracking-tight">
                {slide === 0 ? 'Your card' : 'Your body'}
              </h2>

              {/* Two dots, tappable. At two slides a segmented control would be
                  heavier than the thing it navigates. */}
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Profile pages">
                {SLIDES.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={slide === index}
                    aria-label={index === 0 ? 'Your card' : 'Your body'}
                    onClick={() => goTo(index)}
                    className="flex h-9 w-6 items-center justify-center"
                  >
                    <span
                      className={[
                        'block rounded-pill border-2 border-ink-900 transition-all duration-200',
                        slide === index ? 'h-2.5 w-6 bg-lime-400' : 'h-2.5 w-2.5 bg-cream-50',
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-ink-900"
              >
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={slide}
                  custom={direction}
                  initial={(dir) => ({ opacity: 0, x: dir * 40 })}
                  animate={{ opacity: 1, x: 0 }}
                  exit={(dir) => ({ opacity: 0, x: dir * -40 })}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="px-5 pb-5"
                >
                  {slide === 0 ? (
                    <CardSlide
                      user={user}
                      onUpdateName={onUpdateName}
                      saving={saving}
                      error={error}
                      onClearError={onClearError}
                      onNext={() => goTo(1)}
                      onSignOut={onSignOut}
                    />
                  ) : (
                    <BodySlide
                      goals={goals}
                      onSaveGoals={onSaveGoals}
                      saving={goalsSaving}
                      error={goalsError}
                      onBack={() => goTo(0)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="pb-safe" aria-hidden="true" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ── Slide 1: the card ────────────────────────────────────────────────────── */

function CardSlide({ user, onUpdateName, saving, error, onClearError, onNext, onSignOut }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  const name = displayName(user)
  const email = user?.email ?? ''
  const joined = user?.created_at ? new Date(user.created_at) : null
  const hasRealName = Boolean(user?.user_metadata?.full_name?.trim())

  // Day 1 is the day you joined — nobody has been a member for "0 days".
  const daysIn = joined
    ? Math.max(1, Math.floor((Date.now() - joined.getTime()) / 86_400_000) + 1)
    : null

  useEffect(() => {
    setDraft(hasRealName ? name : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function handleSave() {
    if (!draft.trim() || saving) return
    if (await onUpdateName(draft)) setEditing(false)
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard needs HTTPS and a permission. Not worth an error banner —
      // the address is right there to select by hand.
    }
  }

  return (
    <>
      <div className="relative mt-2">
        <div
          aria-hidden="true"
          className="absolute inset-0 -rotate-2 rounded-[1.75rem] border-2 border-ink-900/15 bg-cream-200"
        />

        <div className="relative overflow-hidden rounded-[1.75rem] border-[2.5px] border-ink-900 bg-cream-50 shadow-stack">
          <div className="relative h-20 bg-lime-400">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #1B1915 0 2px, transparent 2px 11px)',
              }}
            />
            <span className="absolute right-4 top-4 font-display text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-ink-900/60">
              Zephr · member
            </span>
          </div>

          <div className="px-5 pb-5">
            <div className="-mt-10 mb-4 flex items-end justify-between gap-3">
              <Avatar name={name} size={80} />
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    onClearError?.()
                    setEditing(true)
                  }}
                  className="tactile mb-1 inline-flex min-h-[38px] items-center gap-1.5 rounded-pill border-2 border-ink-900 bg-cream-50 px-3 font-display text-xs font-extrabold shadow-press-sm"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  Edit name
                </button>
              )}
            </div>

            {editing ? (
              <div className="animate-pop-in">
                <label htmlFor="profile-name" className="label-caps mb-1.5 block">
                  What should we call you?
                </label>
                <input
                  id="profile-name"
                  ref={inputRef}
                  value={draft}
                  maxLength={60}
                  autoCapitalize="words"
                  placeholder="Your name"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSave()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      e.stopPropagation()
                      setEditing(false)
                    }
                  }}
                  className="w-full min-h-[58px] rounded-2xl border-[2.5px] border-ink-900/15 bg-cream-100 px-4 font-display text-2xl font-extrabold tracking-tight text-ink-900 shadow-inset placeholder:text-ink-300 focus:border-lime-500"
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    icon={Check}
                    loading={saving}
                    disabled={!draft.trim()}
                    onClick={handleSave}
                    className="flex-1"
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="label-caps">Name on the card</p>
                <p className="mt-0.5 break-words font-display text-3xl font-extrabold leading-none tracking-tighter">
                  {name}
                </p>
                {!hasRealName && (
                  <p className="mt-2 text-xs font-semibold leading-snug text-ink-400">
                    We guessed this from your email — set a real one and it’ll show up across
                    the app.
                  </p>
                )}
              </>
            )}

            {/* Perforation: notches centred on the card's edge, so overflow-hidden
                bites exactly half of each out of the border. */}
            <div className="relative my-5" aria-hidden="true">
              <div className="border-t-2 border-dashed border-ink-900/20" />
              <span className="absolute -left-[31px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full border-2 border-ink-900 bg-cream-100" />
              <span className="absolute -right-[31px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full border-2 border-ink-900 bg-cream-100" />
            </div>

            <p className="label-caps mb-1.5">Email</p>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-ink-900/10 bg-cream-100 p-2.5">
              <Mail className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={2.75} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-700">{email}</span>
              <button
                type="button"
                onClick={copyEmail}
                aria-label="Copy email address"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-cream-200 hover:text-ink-900"
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-lime-700" strokeWidth={3} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={2.75} />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs font-medium text-ink-400">
              This is your login, so it can’t be changed here — it’d need a fresh confirmation
              round trip.
            </p>

            <div className="mt-5 flex items-end gap-2 border-t-2 border-ink-900/10 pt-4">
              <Stat
                label="Member since"
                value={joined ? joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}
              />
              <span className="h-8 w-px shrink-0 bg-ink-900/10" aria-hidden="true" />
              <Stat label={daysIn === 1 ? 'Day in' : 'Days in'} value={daysIn === null ? '—' : String(daysIn)} />
              <Icon3D name="star" size={30} className="mb-0.5 ml-auto" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600 animate-pop-in"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="tactile mt-5 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 border-ink-900 bg-cream-50 px-4 text-left shadow-press-sm"
      >
        <Icon3D name="scale" size={28} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-extrabold leading-tight">
            Height, weight & calories
          </span>
          <span className="block truncate text-xs font-semibold text-ink-400">
            Your stats and the target they work out to
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" strokeWidth={3} />
      </button>

      <div className="mt-5 border-t-2 border-dashed border-ink-900/10 pt-5">
        <Button variant="secondary" size="md" icon={LogOut} fullWidth onClick={onSignOut}>
          Log out
        </Button>
      </div>
    </>
  )
}

/* ── Slide 2: body stats and the target they imply ───────────────────────── */

function BodySlide({ goals, onSaveGoals, saving, error, onBack }) {
  const [draft, setDraft] = useState(() => seedFrom(goals))
  const [confirming, setConfirming] = useState(null)
  const [savedNote, setSavedNote] = useState(false)

  const body = { ...draft }
  const targets = calculateTargets(body)
  const bmi = bmiOf(body)
  const currentCalories = Number(goals?.calories) || 0
  const suggested = targets?.calories ?? null
  const differs = suggested !== null && Math.abs(suggested - currentCalories) >= 10

  function update(patch) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setSavedNote(false)
  }

  /**
   * Save stats first, always. Then — and only if the equation now disagrees
   * with the stored target — ask. Body stats and calorie goals are two
   * different decisions and shouldn't ride on one button.
   */
  async function handleSave() {
    const ok = await onSaveGoals({ ...goals, ...draft })
    if (!ok) return

    if (differs) setConfirming({ from: currentCalories, to: suggested })
    else {
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2400)
    }
  }

  async function applyCalories() {
    const ok = await onSaveGoals({
      ...goals,
      ...draft,
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
    })
    if (ok) {
      setConfirming(null)
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2400)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-ink-400 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={3} />
        Back to your card
      </button>

      {/* Height and weight, given the space they deserve — they're the two the
          user came here to change. */}
      <div className="grid grid-cols-2 gap-3">
        <StatField
          icon="ruler"
          label="Height"
          suffix="cm"
          placeholder="170"
          value={draft.height_cm}
          onChange={(v) => update({ height_cm: v })}
        />
        <StatField
          icon="scale"
          label="Weight"
          suffix="kg"
          placeholder="70"
          value={draft.weight_kg}
          onChange={(v) => update({ weight_kg: v })}
        />
      </div>

      {bmi && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3">
          <Icon3D name="chart" size={26} />
          <p className="min-w-0 flex-1 text-sm font-bold text-ink-700">
            BMI <span className="nums">{bmi.value}</span>
            <span className="ml-1.5 text-xs font-semibold text-ink-400">{bmi.label}</span>
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Input
          label="Age"
          type="number"
          inputMode="numeric"
          placeholder="28"
          value={draft.age}
          onFocus={(e) => e.target.select()}
          onChange={(e) => update({ age: e.target.value })}
          className="font-display"
        />
        <div>
          <p className="label-caps mb-1.5">Sex</p>
          <Segmented options={SEXES} value={draft.sex} onChange={(sex) => update({ sex })} />
        </div>
      </div>

      <div className="mt-5">
        <p className="label-caps mb-2">Activity</p>
        <div className="space-y-1.5">
          {ACTIVITY_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => update({ activity: level.id })}
              aria-pressed={draft.activity === level.id}
              className={[
                'flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 px-3 text-left transition-colors',
                draft.activity === level.id
                  ? 'border-ink-900 bg-lime-100 shadow-press-sm'
                  : 'border-ink-900/10 bg-cream-50 hover:border-ink-900/30',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-extrabold leading-tight">
                  {level.label}
                </span>
                <span className="block truncate text-[0.7rem] font-semibold text-ink-400">
                  {level.hint}
                </span>
              </span>
              {draft.activity === level.id && <Check className="h-4 w-4 shrink-0" strokeWidth={3.5} />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="label-caps mb-2">Aiming to</p>
        <Segmented options={AIMS} value={draft.aim} onChange={(aim) => update({ aim })} />
      </div>

      {/* The number, with its working shown. */}
      <div className="mt-5 rounded-2xl border-2 border-ink-900 bg-lime-100 p-4 shadow-press-sm">
        <p className="label-caps">Calories this works out to</p>
        {targets ? (
          <>
            <p className="nums mt-1 font-display text-4xl font-extrabold leading-none">
              {targets.calories}
              <span className="ml-1.5 font-sans text-sm font-bold text-ink-500">kcal/day</span>
            </p>
            <p className="nums mt-2 text-xs font-bold text-ink-500">
              {targets.protein}p · {targets.carbs}c · {targets.fat}f
            </p>
            <p className="mt-2 text-[0.7rem] font-semibold leading-snug text-ink-500">
              At rest you burn about {targets.bmr} kcal; with your activity that’s ~{targets.tdee}
              {' '}a day. An average for your stats, not a measurement of you — give it a fortnight
              and adjust to what actually happens.
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-ink-900/10 bg-cream-50 p-2.5">
              <span className="min-w-0 flex-1 text-xs font-bold text-ink-500">
                Your target right now
              </span>
              <span className="nums shrink-0 font-display text-base font-extrabold">
                {currentCalories} kcal
              </span>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-ink-500">
            Fill in height, weight and age and the estimate appears here.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
          <span>{error}</span>
        </div>
      )}

      <AnimatePresence>
        {savedNote && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-sm font-extrabold text-lime-700"
          >
            <Check className="h-4 w-4" strokeWidth={3.5} />
            Saved.
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        size="lg"
        fullWidth
        icon={Save}
        loading={saving && !confirming}
        className="mt-5"
        onClick={handleSave}
      >
        Save my stats
      </Button>

      {/* Confirmation. Inline rather than a nested modal — a dialog on top of a
          dialog is where focus management goes to die. */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border-2 border-ink-900 bg-cream-50 p-4 shadow-press-sm">
              <div className="flex items-start gap-3">
                <Icon3D name="target" size={30} />
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold leading-tight">
                    Update your daily target too?
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug text-ink-500">
                    Your stats are saved. Based on them your target would be{' '}
                    <strong className="nums text-ink-900">{confirming.to} kcal</strong> instead of{' '}
                    <strong className="nums text-ink-900">{confirming.from}</strong>. Your macros
                    would be recalculated to match.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" icon={Check} loading={saving} onClick={applyCalories} className="flex-1">
                  Yes, update
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirming(null)}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

function seedFrom(goals) {
  return {
    height_cm: goals?.height_cm ?? '',
    weight_kg: goals?.weight_kg ?? '',
    age: goals?.age ?? '',
    sex: goals?.sex ?? 'male',
    activity: goals?.activity ?? 'light',
    aim: goals?.aim ?? 'maintain',
  }
}

/** A big, friendly number field — these two are the point of the slide. */
function StatField({ icon, label, suffix, placeholder, value, onChange }) {
  return (
    <div className="rounded-2xl border-2 border-ink-900/10 bg-cream-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon3D name={icon} size={22} />
        <span className="label-caps">{label}</span>
      </div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="nums w-full min-h-[58px] rounded-xl border-2 border-ink-900/15 bg-cream-100 pl-3 pr-11 font-display text-3xl font-extrabold text-ink-900 shadow-inset placeholder:text-ink-300 focus:border-lime-500"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-display text-sm font-extrabold text-ink-300">
          {suffix}
        </span>
      </div>
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div
      className="grid gap-1 rounded-2xl border-2 border-ink-900/10 bg-cream-200 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={[
            'min-h-[44px] rounded-xl px-1 font-display text-sm font-extrabold transition-all duration-150',
            value === option.id
              ? 'border-2 border-ink-900 bg-cream-50 shadow-press-sm'
              : 'text-ink-400 hover:text-ink-700',
          ].join(' ')}
        >
          {option.label}
          {option.hint && (
            <span className="mt-0.5 block text-[0.6rem] font-bold text-ink-300">{option.hint}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="label-caps truncate">{label}</p>
      <p className="nums mt-0.5 truncate font-display text-sm font-extrabold text-ink-700">{value}</p>
    </div>
  )
}
