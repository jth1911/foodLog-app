import { useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { type FoodEntry, type GoalChange } from './lib/nutrition'
import {
  calorieHeatmap,
  monthlyMacroRatio,
  topFoods,
  type CalorieStatus,
} from './lib/monthly'
import { addMonths, monthDays, startOfMonth, todayIso } from './lib/dates'

// Heatmap cell colour per calorie status. Finishing comfortably under the goal
// is the win, so green is the band below the floor; amber warns as intake nears
// the goal (within the ±band), rose flags exceeding the ceiling, and a faint
// slate marks days with no log.
const STATUS_COLORS: Record<CalorieStatus, string> = {
  under: 'bg-emerald-500',
  'in-range': 'bg-amber-400',
  over: 'bg-rose-500',
  empty: 'bg-slate-100',
}

const STATUS_LABELS: Record<CalorieStatus, string> = {
  under: 'Under',
  'in-range': 'Near goal',
  over: 'Surplus',
  empty: 'No log',
}

// Macro hues mirror the Weekly report's macro trend colours so the split reads
// consistently across reports (protein green, carbs blue, fat amber).
const MACRO_COLORS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: '#16a34a',
  carbs: '#2563eb',
  fat: '#d97706',
}

const MACRO_LABELS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
}

// Monday-first weekday headers for the calendar grid.
const WEEKDAY_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Day-of-month from an ISO date, without timezone drift (the day part verbatim).
function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10))
}

// Monday-first weekday index (Mon=0 … Sun=6) for an ISO date, in UTC.
function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // Sun=0
  return (utcDay + 6) % 7
}

// Readable month label, e.g. "June 2026", formatted in UTC.
const monthFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatMonth(iso: string): string {
  const [year, month] = iso.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)))
}

// Slice labels like "Protein 30%". Uses Recharts' own label props — `name` (our
// `macro` nameKey, lower-cased, so it's mapped through MACRO_LABELS for display)
// and `percent` (the slice's 0–1 fraction).
function renderSliceLabel(props: { name?: string; percent?: number }): string {
  const label = MACRO_LABELS[props.name as 'protein' | 'carbs' | 'fat'] ?? props.name
  return `${label} ${Math.round((props.percent ?? 0) * 100)}%`
}

type MonthlyReportProps = {
  loggedFoods: FoodEntry[]
  goalHistory: GoalChange[]
  // The month to land on (any day within it). Defaults to the real current
  // month; injectable so tests pin a known month instead of the live clock.
  today?: string
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

/**
 * The Monthly report (big-picture view): a full-month calendar heatmap of daily
 * calories against the goal band, the month's most-frequent foods, and the
 * overall protein/carbs/fat split. All figures derive from the shared food log
 * and the effective-dated goals — each day's heatmap cell is judged against the
 * goal in effect on that day, so editing goals on the Goals tab flows through.
 */
function MonthlyReport({ loggedFoods, goalHistory, today = todayIso() }: MonthlyReportProps) {
  const currentMonth = startOfMonth(today)
  const [month, setMonth] = useState(currentMonth)

  const dates = useMemo(() => monthDays(month), [month])
  const heatmap = useMemo(
    () => calorieHeatmap(loggedFoods, goalHistory, dates),
    [loggedFoods, goalHistory, dates],
  )
  const foods = useMemo(() => topFoods(loggedFoods, dates), [loggedFoods, dates])
  const macroData = useMemo(() => monthlyMacroRatio(loggedFoods, dates), [loggedFoods, dates])

  // Forward navigation is clamped at the current month — there's no data ahead.
  const atCurrentMonth = month >= currentMonth
  const leadingBlanks = dates.length > 0 ? weekdayIndex(dates[0]) : 0
  const hasMacros = macroData.some((m) => m.grams > 0)
  const visibleMacros = macroData.filter((m) => m.grams > 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly report</h1>
          <p className="text-sm text-slate-500">{formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={atCurrentMonth}
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setMonth(currentMonth)}
            className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
          >
            This month
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Calorie ceiling & floor heatmap */}
        <section aria-label="Calorie heatmap" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Calorie ceiling &amp; floor</h2>
          <p className="mb-4 text-sm text-slate-500">
            Each logged day against its calorie goal — green is comfortably under, amber nearing it, red over.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_HEADS.map((wd) => (
              <div key={wd} className="pb-1 text-center text-xs font-medium text-slate-400">
                {wd}
              </div>
            ))}
            {/* Leading blanks so the 1st lines up under its weekday. */}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {heatmap.map((day) => (
              <div
                key={day.date}
                title={
                  day.status === 'empty'
                    ? `${day.date}: no log`
                    : `${day.date}: ${Math.round(day.calories)} kcal — ${STATUS_LABELS[day.status]}`
                }
                className={`flex aspect-square items-center justify-center rounded text-xs font-medium ${
                  STATUS_COLORS[day.status]
                } ${day.status === 'empty' ? 'text-slate-400' : 'text-white'}`}
              >
                {dayOfMonth(day.date)}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {(['under', 'in-range', 'over', 'empty'] as CalorieStatus[]).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 rounded ${STATUS_COLORS[status]}`} />
                {STATUS_LABELS[status]}
              </span>
            ))}
          </div>
        </section>

        {/* Top 5 most frequent foods */}
        <section aria-label="Top foods" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Most-logged foods</h2>
          <p className="mb-4 text-sm text-slate-500">Your 5 most frequent foods this month.</p>
          {foods.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {foods.map((food, i) => (
                <li key={food.description} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-700">{food.description}</span>
                  <span className="shrink-0 text-sm font-medium text-slate-400">
                    {food.count}×
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No foods logged this month.</p>
          )}
        </section>

        {/* Monthly average macro ratio */}
        <section aria-label="Macro ratio" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Macro ratio</h2>
          <p className="mb-4 text-sm text-slate-500">
            Protein / carbs / fat split across the month.
          </p>
          {hasMacros ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleMacros}
                    dataKey="grams"
                    nameKey="macro"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    label={renderSliceLabel}
                  >
                    {visibleMacros.map((slice) => (
                      <Cell key={slice.macro} fill={MACRO_COLORS[slice.macro]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} g`, MACRO_LABELS[name as 'protein' | 'carbs' | 'fat'] ?? name]} />
                  <Legend formatter={(name) => MACRO_LABELS[name as 'protein' | 'carbs' | 'fat'] ?? name} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No macros logged this month.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default MonthlyReport
