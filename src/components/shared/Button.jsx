import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * The tactile button.
 *
 * Every variant renders a hard bottom edge (shadow-press) that collapses on
 * :active, so the button physically compresses under a thumb. Minimum height is
 * 48px on every size except `xs` — below ~44px, touch targets start failing.
 */

const VARIANTS = {
  // The one thing on screen asking to be tapped.
  primary:
    'bg-lime-400 text-ink-900 border-ink-900 shadow-press hover:bg-lime-300 disabled:bg-lime-200',
  // Equal weight, lower urgency.
  secondary:
    'bg-cream-50 text-ink-900 border-ink-900 shadow-press hover:bg-cream-100 disabled:text-ink-300',
  // Destructive, and it looks it.
  danger:
    'bg-coral-500 text-cream-50 border-ink-900 shadow-press hover:bg-coral-600',
  // No chrome until you touch it.
  ghost:
    'bg-transparent text-ink-500 border-transparent shadow-none hover:bg-cream-200 hover:text-ink-900',
}

const SIZES = {
  xs: 'min-h-[36px] px-3 text-xs gap-1.5 rounded-xl border-2',
  sm: 'min-h-[44px] px-4 text-sm gap-2 rounded-2xl border-2',
  md: 'min-h-[52px] px-5 text-[0.95rem] gap-2 rounded-2xl border-[2.5px]',
  lg: 'min-h-[58px] px-6 text-base gap-2.5 rounded-[1.25rem] border-[3px]',
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'tactile inline-flex select-none items-center justify-center font-display font-extrabold tracking-tight',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:translate-y-0',
        SIZES[size],
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-[1.15em] w-[1.15em] animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-[1.15em] w-[1.15em]" strokeWidth={2.75} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight className="h-[1.15em] w-[1.15em]" strokeWidth={2.75} aria-hidden="true" />
      )}
    </button>
  )
})

export default Button

/**
 * Square icon-only button — used for date arrows and row actions, where a label
 * would be noise. `label` is required: it becomes the accessible name.
 */
export function IconButton({
  icon: Icon,
  label,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}) {
  const box = size === 'sm' ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        'tactile inline-flex shrink-0 items-center justify-center border-2',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-y-0',
        box,
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...props}
    >
      <Icon className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
    </button>
  )
}
