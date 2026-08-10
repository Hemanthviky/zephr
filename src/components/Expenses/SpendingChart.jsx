import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import Icon3D from '../shared/Icon3D'
import { formatMoney } from '../../utils/expenseMath'

/**
 * Where the month went — a donut of spending by category.
 *
 * Recharts ships a blue-and-green default theme; every visual decision here
 * overrides it. Slices take each category's own colour (the same hex the picker
 * tile and the log row use), get an ink outline and rounded ends to match the
 * app's chunky borders, and the tooltip is a cream card rather than the stock
 * white box.
 */
export default function SpendingChart({ categoryTotals, total, loading = false }) {
  if (loading) {
    return (
      <div className="card p-5">
        <div className="skeleton mx-auto h-[190px] w-[190px] rounded-full" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!categoryTotals.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-9 text-center">
        <Icon3D name="chartdown" size={64} className="mb-3" />
        <p className="font-display text-base font-extrabold">No breakdown yet</p>
        <p className="mx-auto mt-1.5 max-w-[15rem] text-sm font-medium text-ink-400">
          Log a couple of expenses and this fills in with your categories.
        </p>
      </div>
    )
  }

  // Anything under 4% gets folded into "Other" — a dozen hairline slices is a
  // decoration, not a breakdown.
  const threshold = 0.04
  const major = categoryTotals.filter((c) => c.share >= threshold)
  const minor = categoryTotals.filter((c) => c.share < threshold)
  const slices = minor.length
    ? [
        ...major,
        {
          id: '__rest',
          name: `${minor.length} smaller`,
          color: '#BDB4A2',
          icon: 'receipt',
          total: minor.reduce((sum, c) => sum + c.total, 0),
          share: minor.reduce((sum, c) => sum + c.share, 0),
        },
      ]
    : major

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon3D name="chart" size={24} />
        <h3 className="font-display text-base font-extrabold tracking-tight">Where it went</h3>
      </div>
      <p className="mb-3 text-xs font-semibold text-ink-400">
        Spending by category, this month
      </p>

      <div className="relative mx-auto h-[210px] w-full max-w-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={7}
              startAngle={90}
              endAngle={-270}
              stroke="#1B1915"
              strokeWidth={2}
              isAnimationActive
              animationDuration={550}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} cursor={false} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre readout, in HTML rather than SVG text so it uses the real
            display font and tabular figures. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-caps">total out</span>
          <span className="nums font-display text-2xl font-extrabold leading-none">
            {formatMoney(total, { compact: true })}
          </span>
          <span className="mt-1 text-[0.65rem] font-bold text-ink-400">
            {categoryTotals.length} categories
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {categoryTotals.map((category) => (
          <li key={category.id} className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-md border-2 border-ink-900/25"
              style={{ background: category.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-700">
              {category.name}
            </span>
            <span className="nums shrink-0 text-xs font-extrabold text-ink-400">
              {Math.round(category.share * 100)}%
            </span>
            <span className="nums w-[76px] shrink-0 text-right font-display text-sm font-extrabold">
              {formatMoney(category.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const slice = payload[0].payload

  return (
    <div className="rounded-xl border-2 border-ink-900 bg-cream-50 px-3 py-2 shadow-stack">
      <p className="flex items-center gap-2 font-display text-sm font-extrabold">
        <span
          className="h-2.5 w-2.5 rounded-sm border border-ink-900/30"
          style={{ background: slice.color }}
        />
        {slice.name}
      </p>
      <p className="nums mt-0.5 text-sm font-extrabold text-ink-700">
        {formatMoney(slice.total)}
        <span className="ml-1.5 text-xs font-bold text-ink-400">
          {total > 0 ? `${Math.round((slice.total / total) * 100)}%` : ''}
        </span>
      </p>
    </div>
  )
}
