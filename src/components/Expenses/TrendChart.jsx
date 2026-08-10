import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import Icon3D from '../shared/Icon3D'
import { averageSpend, formatMoney } from '../../utils/expenseMath'

/**
 * Six months of spending, as one line.
 *
 * Same override discipline as the donut: no default grid, no default palette,
 * no axis lines. Coral for money going out (consistent with the "over budget"
 * colour everywhere else), a dashed ink average line for context, and dots big
 * enough to be a touch target on a phone.
 */
export default function TrendChart({ series, loading = false }) {
  if (loading) {
    return (
      <div className="card p-5">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-4 h-[180px] w-full rounded-2xl sm:h-[210px]" />
      </div>
    )
  }

  const average = averageSpend(series)
  const spent = series.filter((point) => point.expense > 0)

  if (!spent.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-9 text-center">
        <Icon3D name="chart" size={64} className="mb-3" />
        <p className="font-display text-base font-extrabold">No trend yet</p>
        <p className="mx-auto mt-1.5 max-w-[15rem] text-sm font-medium text-ink-400">
          Once you’ve logged a couple of months, you’ll see the shape of your
          spending here.
        </p>
      </div>
    )
  }

  // Latest vs the previous month that actually had spending — comparing against
  // an empty month would report a meaningless +100%.
  const latest = series[series.length - 1]
  const previous = [...series].slice(0, -1).reverse().find((point) => point.expense > 0)
  const delta = previous ? latest.expense - previous.expense : 0
  const deltaPct = previous && previous.expense > 0 ? Math.round((delta / previous.expense) * 100) : 0

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon3D name="chartdown" size={24} />
        <h3 className="font-display text-base font-extrabold tracking-tight">Six-month trend</h3>
      </div>
      <p className="mb-4 text-xs font-semibold text-ink-400">
        Total spent per month · avg {formatMoney(average, { compact: true })}
      </p>

      <div className="-ml-2 h-[190px] w-full sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 7"
              stroke="#E2CDA4"
              strokeWidth={1.5}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              dy={6}
              tick={{ fill: '#948B7B', fontSize: 11, fontWeight: 800 }}
            />
            <YAxis
              width={46}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#BDB4A2', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(value) => formatMoney(value, { compact: true })}
            />

            {average > 0 && (
              <ReferenceLine
                y={average}
                stroke="#1B1915"
                strokeOpacity={0.35}
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            )}

            <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#BDB4A2', strokeWidth: 2 }} />

            <Line
              type="monotone"
              dataKey="expense"
              stroke="#FF5A38"
              strokeWidth={4}
              strokeLinecap="round"
              dot={{ r: 5, fill: '#FFFDF7', stroke: '#FF5A38', strokeWidth: 3 }}
              activeDot={{ r: 8, fill: '#FF5A38', stroke: '#1B1915', strokeWidth: 2.5 }}
              animationDuration={650}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {previous && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-ink-400">
          <span
            className={`nums font-display text-sm font-extrabold ${
              delta > 0 ? 'text-coral-600' : 'text-lime-700'
            }`}
          >
            {delta > 0 ? '↑' : '↓'} {formatMoney(Math.abs(delta), { compact: true })}
            {deltaPct !== 0 && ` (${Math.abs(deltaPct)}%)`}
          </span>
          vs {previous.label}
        </p>
      )}
    </div>
  )
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="rounded-xl border-2 border-ink-900 bg-cream-50 px-3 py-2 shadow-stack">
      <p className="font-display text-sm font-extrabold">{point.label}</p>
      <p className="nums mt-0.5 text-sm font-extrabold text-coral-600">
        −{formatMoney(point.expense)}
      </p>
      {point.income > 0 && (
        <p className="nums text-xs font-bold text-lime-700">+{formatMoney(point.income)} in</p>
      )}
    </div>
  )
}
