import { AlertTriangle } from 'lucide-react'

/**
 * The bits every auth form needs.
 *
 * Signup, and now the reset-password form, both ask for a password the user is
 * choosing rather than recalling, and both report server errors the same way.
 * Two copies was a coincidence; three would be a fork waiting to happen — the
 * meter's thresholds in particular have to agree with themselves, or "Strong"
 * on the signup form and "Good" on the reset form describe the same password.
 */

/** Bottom-to-top strength meter — cheap heuristic, honest labels. */
export function strengthOf(password) {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++

  return [
    { score: 0, label: '', color: '' },
    { score: 1, label: 'Weak', color: '#FF5A38' },
    { score: 2, label: 'Okay', color: '#FFA51F' },
    { score: 3, label: 'Good', color: '#AEDC0B' },
    { score: 4, label: 'Strong', color: '#12B39A' },
  ][score]
}

/** Four segments and a word. Renders nothing until there's a password to judge. */
export function PasswordStrength({ password, hidden = false }) {
  if (!password || hidden) return null
  const strength = strengthOf(password)

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className="h-1.5 flex-1 rounded-pill transition-colors duration-200"
            style={{
              background: step <= strength.score ? strength.color : 'rgb(var(--c-cream-200))',
            }}
          />
        ))}
      </div>
      <span
        className="w-12 text-right text-[0.7rem] font-extrabold uppercase tracking-wide"
        style={{ color: strength.color }}
      >
        {strength.label}
      </span>
    </div>
  )
}

/** Whatever the server said, in the app's red. */
export function FormError({ children, className = 'mt-4' }) {
  if (!children) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-2xl border-2 border-coral-500 bg-coral-100 p-3 text-sm font-semibold text-coral-600 animate-pop-in ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.75} />
      <span>{children}</span>
    </div>
  )
}
