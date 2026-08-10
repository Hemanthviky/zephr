import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon3D from '../shared/Icon3D'
import { walletIcon } from '../../data/defaultCategories'

/**
 * Horizontal wallet chips.
 *
 * Used in two places with the same component: inside the add form to pick which
 * wallet a transaction came out of, and above the log as a filter (where
 * `includeAll` adds an "All" chip). Scrolls sideways once someone adds a fourth
 * or fifth wallet rather than wrapping into a growing block.
 */
export default function WalletPicker({
  wallets,
  value,
  onChange,
  includeAll = false,
  onCreate,
  loading = false,
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return

    setBusy(true)
    const created = await onCreate(trimmed)
    setBusy(false)

    if (created) {
      onChange(created.id)
      setName('')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[46px] w-24 rounded-pill" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {includeAll && (
          <Chip
            active={value === null}
            onClick={() => onChange(null)}
            icon="moneybag"
            label="All"
          />
        )}

        {wallets.map((wallet) => (
          <Chip
            key={wallet.id}
            active={value === wallet.id}
            onClick={() => onChange(wallet.id)}
            icon={walletIcon(wallet.name)}
            label={wallet.name}
          />
        ))}

        {onCreate && (
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            aria-expanded={creating}
            aria-label="Add a wallet"
            className="tactile flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-pill border-2 border-dashed border-ink-900/25 bg-cream-100 hover:border-ink-900/50"
          >
            <Plus className="h-4 w-4 text-ink-500" strokeWidth={3} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
                maxLength={40}
                placeholder="e.g. UPI, Savings"
                className="min-h-[46px] w-full flex-1 rounded-2xl border-2 border-ink-900/15 bg-cream-50 px-4 text-base font-semibold shadow-inset placeholder:font-medium placeholder:text-ink-300 focus:border-lime-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || busy}
                aria-label="Save wallet"
                className="tactile flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border-2 border-ink-900 bg-lime-400 shadow-press-sm disabled:opacity-50"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Cancel"
                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl text-ink-400 hover:bg-cream-200"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Chip({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'tactile flex min-h-[46px] shrink-0 items-center gap-2 rounded-pill border-2 px-3.5 font-display text-sm font-extrabold transition-colors',
        active
          ? 'border-ink-900 bg-lime-400 shadow-press-sm'
          : 'border-ink-900/10 bg-cream-50 text-ink-500 hover:border-ink-900/30',
      ].join(' ')}
    >
      <Icon3D name={icon} size={20} />
      {label}
    </button>
  )
}
