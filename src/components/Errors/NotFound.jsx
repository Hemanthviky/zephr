import { ArrowLeft, RotateCcw } from 'lucide-react'
import Button from '../shared/Button'
import Icon3D from '../shared/Icon3D'
import ErrorShell from './ErrorShell'

/**
 * 404 — rendered as a nutrition label.
 *
 * The whole app is built on the idea that a number on a label tells you what
 * you're about to get. So a page that doesn't exist gets the same treatment,
 * and every line reads zero. It's the one joke the app is allowed to make: the
 * layout is doing the explaining, which means the copy doesn't have to
 * apologise for three paragraphs.
 *
 * The proportions are borrowed from a real FDA panel — hairline rules between
 * rows, a 4px rule between blocks, an 8px slab under the title, and one number
 * set far larger than everything around it. Getting those weights right is what
 * makes it read as a label instead of a table with a funny heading.
 */

// [name, amount, % daily value]
const FACTS = [
  ['Content', '0 g', '0%'],
  ['Substance', '0 g', '0%'],
  ['Answers', '0 mg', '0%'],
  ['Usefulness', '0 g', '0%'],
]

export default function NotFound({ path = window.location.pathname }) {
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1

  return (
    <ErrorShell
      actions={
        <>
          <Button
            size="lg"
            fullWidth
            icon={ArrowLeft}
            onClick={() => {
              window.location.href = '/'
            }}
          >
            Back to today
          </Button>
          {canGoBack && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              icon={RotateCcw}
              onClick={() => window.history.back()}
            >
              Or go back one step
            </Button>
          )}
        </>
      }
      footer="Zephr only has two pages, and this isn't either of them."
    >
      <div className="w-full max-w-[380px] animate-pop-in">
        <Icon3D name="plate" size={78} float className="mx-auto mb-5 block" />

        <article className="rounded-[1.5rem] border-[3px] border-ink-900 bg-cream-50 p-5 shadow-stack">
          <p className="label-caps text-ink-500">Zephr</p>

          <h1 className="mt-0.5 font-display text-[2.7rem] font-extrabold leading-[0.9] tracking-tighter">
            Error Facts
          </h1>
          <p className="mt-1.5 text-sm font-bold text-ink-500">1 page, not found</p>

          <Rule weight="slab" />

          <p className="text-[0.82rem] font-extrabold">Amount per page</p>

          {/* The oversized number, exactly where a real label puts its calories. */}
          <div className="flex items-end justify-between gap-3">
            <span className="pb-2 font-display text-[1.35rem] font-extrabold tracking-tight">
              Status
            </span>
            <span className="nums font-display text-hero leading-[0.8] tracking-tighter text-ink-900">
              404
            </span>
          </div>

          <Rule weight="thick" />

          <p className="pb-1 text-right text-[0.72rem] font-extrabold">% Daily Value*</p>

          <div className="border-t-2 border-ink-900">
            {FACTS.map(([name, amount, dv]) => (
              <Fact key={name} name={name} amount={amount} dv={dv} />
            ))}
            {/* The one line that isn't zero. */}
            <Fact name="Mild regret" amount="2 g" dv="14%" />
          </div>

          <Rule weight="thick" />

          <p className="text-[0.7rem] font-semibold leading-snug text-ink-500">
            * Percent Daily Values are based on a page that exists. This one does not, so they
            aren&rsquo;t based on anything.
          </p>

          <div className="mt-3 border-t-2 border-dashed border-ink-900/20 pt-3">
            <p className="break-all text-[0.68rem] font-extrabold uppercase leading-relaxed tracking-[0.08em] text-ink-400">
              Ingredients:{' '}
              <span className="normal-case tracking-normal text-ink-700">{truncate(path)}</span>
            </p>
          </div>
        </article>
      </div>
    </ErrorShell>
  )
}

/** Horizontal rules, at the three weights a nutrition panel actually uses. */
function Rule({ weight }) {
  const height = { slab: 'h-[9px]', thick: 'h-[5px]', hair: 'h-px' }[weight]
  return <div className={`my-2 bg-ink-900 ${height}`} aria-hidden="true" />
}

function Fact({ name, amount, dv }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-ink-900/25 py-[7px] text-[0.88rem] last:border-b-0">
      <span className="font-medium text-ink-700">
        <span className="font-extrabold text-ink-900">{name}</span> {amount}
      </span>
      <span className="nums font-extrabold">{dv}</span>
    </div>
  )
}

/** A pasted-in URL can be enormous; the label has a fixed width to protect. */
function truncate(value, max = 64) {
  if (!value) return '/'
  return value.length > max ? `${value.slice(0, max)}…` : value
}
