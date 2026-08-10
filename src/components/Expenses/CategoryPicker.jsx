import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, X } from 'lucide-react'
import Icon3D from '../shared/Icon3D'
import Input from '../shared/Input'
import Button from '../shared/Button'
import { CATEGORY_ICON_CHOICES, CATEGORY_COLOR_CHOICES } from '../../data/defaultCategories'

/**
 * Category grid.
 *
 * A grid of icon tiles rather than a <select>: on a phone, picking "Groceries"
 * should be one thumb tap against a recognisable icon, not a scroll through a
 * native picker wheel. The last tile opens an inline creator so adding a
 * category never costs you the transaction you were half-way through entering.
 */
export default function CategoryPicker({ categories, value, onChange, onCreate, loading = false }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(CATEGORY_ICON_CHOICES[0])
  const [color, setColor] = useState(CATEGORY_COLOR_CHOICES[0])
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return

    setBusy(true)
    const created = await onCreate({ name: trimmed, icon, color })
    setBusy(false)

    if (created) {
      onChange(created.id)
      setName('')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-[86px] rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {categories.map((category) => {
          const active = value === category.id
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id)}
              aria-pressed={active}
              className={[
                'tactile flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-2 transition-colors',
                active
                  ? 'border-ink-900 shadow-press-sm'
                  : 'border-ink-900/10 bg-cream-50 hover:border-ink-900/30',
              ].join(' ')}
              // Selected tiles wash in their own category colour, so the choice
              // is legible at a glance and matches the donut slice later.
              style={active ? { background: `${category.color}2E` } : undefined}
            >
              <Icon3D name={category.icon || 'receipt'} size={28} />
              <span className="w-full truncate px-0.5 text-center text-[0.65rem] font-extrabold leading-tight text-ink-700">
                {category.name}
              </span>
              {active && (
                <span
                  className="h-1 w-6 rounded-pill"
                  style={{ background: category.color }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          aria-expanded={creating}
          className={[
            'tactile flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-1 py-2 transition-colors',
            creating
              ? 'border-ink-900 bg-lime-100'
              : 'border-ink-900/25 bg-cream-100 hover:border-ink-900/50',
          ].join(' ')}
        >
          <Plus className="h-6 w-6 text-ink-500" strokeWidth={3} aria-hidden="true" />
          <span className="text-[0.65rem] font-extrabold leading-tight text-ink-500">New</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border-2 border-ink-900 bg-cream-50 p-3.5 shadow-press-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-caps">New category</p>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  aria-label="Cancel new category"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-cream-200 hover:text-ink-900"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>

              <Input
                placeholder="e.g. Gym, Pets, Chai fund"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />

              <p className="label-caps mb-2 mt-4">Icon</p>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {CATEGORY_ICON_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setIcon(choice)}
                    aria-label={`Icon ${choice}`}
                    aria-pressed={icon === choice}
                    className={[
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
                      icon === choice
                        ? 'border-ink-900 bg-lime-100'
                        : 'border-ink-900/10 bg-cream-100 hover:border-ink-900/30',
                    ].join(' ')}
                  >
                    <Icon3D name={choice} size={24} />
                  </button>
                ))}
              </div>

              <p className="label-caps mb-2 mt-4">Colour</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLOR_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setColor(choice)}
                    aria-label={`Colour ${choice}`}
                    aria-pressed={color === choice}
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-transform',
                      color === choice ? 'border-ink-900 scale-105' : 'border-ink-900/10',
                    ].join(' ')}
                    style={{ background: choice }}
                  >
                    {color === choice && (
                      <Check className="h-4 w-4 text-ink-900" strokeWidth={3.5} />
                    )}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                fullWidth
                icon={Plus}
                className="mt-4"
                loading={busy}
                disabled={!name.trim()}
                onClick={handleCreate}
              >
                Add category
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
