import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Text/number field.
 *
 * 16px minimum font size on the control itself is deliberate: anything smaller
 * makes iOS Safari zoom the viewport on focus, which wrecks a mobile-first
 * layout the first time someone taps the email field.
 *
 * Pass `revealable` on a password field to get the eye toggle. It's opt-in
 * rather than automatic on `type="password"` so a field can still be a
 * genuinely hidden one where that's the point.
 */
const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    suffix,
    icon: Icon,
    revealable = false,
    className = '',
    containerClassName = '',
    id: providedId,
    type = 'text',
    ...props
  },
  ref
) {
  const generatedId = useId()
  const id = providedId || generatedId
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  const [revealed, setRevealed] = useState(false)
  const canReveal = revealable && type === 'password'
  const resolvedType = canReveal && revealed ? 'text' : type

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="label-caps mb-1.5 block">
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        )}

        <input
          ref={ref}
          id={id}
          type={resolvedType}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full min-h-[52px] rounded-2xl border-[2.5px] bg-cream-50 text-base font-semibold text-ink-900',
            'placeholder:font-medium placeholder:text-ink-300',
            'transition-colors duration-150',
            'shadow-inset focus:bg-cream-50',
            Icon ? 'pl-12' : 'pl-4',
            suffix || canReveal ? 'pr-14' : 'pr-4',
            error
              ? 'border-coral-500 focus:border-coral-500'
              : 'border-ink-900/15 hover:border-ink-900/30 focus:border-lime-500',
            className,
          ].join(' ')}
          {...props}
        />

        {canReveal && (
          <button
            type="button"
            // Never a submit button, and never a tab stop between the password
            // field and the form's actual submit — it's a convenience, not a step.
            tabIndex={-1}
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            title={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-cream-200 hover:text-ink-900"
          >
            {revealed ? (
              <EyeOff className="h-5 w-5" strokeWidth={2.5} />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={2.5} />
            )}
          </button>
        )}

        {suffix && !canReveal && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm font-extrabold text-ink-400">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-coral-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm font-medium text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export default Input
