import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { goalsForDate, type FoodEntry, type GoalChange, type MealType } from './lib/nutrition'
import {
  dailyMacroSeries,
  fiberSeries,
  mealCalorieBreakdown,
  proteinStreak,
  weekWindow,
} from './lib/weekly'
import { addDays, todayIso } from './lib/dates'

// Meal colours mirror the meal headers elsewhere in the app (blue / green /
// purple / amber for Breakfast / Lunch / Dinner / Snacks) so the pie reads the
// same as the food log.
const MEAL_COLORS: Record<MealType, string> = {
  Breakfast: '#2563eb',
  Lunch: '#16a34a',
  Dinner: '#9333ea',
  Snacks: '#d97706',
}

// Distinct hues for the three macro trend lines.
const MACRO_COLORS = {
  protein: '#16a34a',
  carbs: '#2563eb',
  fat: '#d97706',
}

// Short weekday + day-of-month tick label for the x-axes, formatted in UTC to
// match the rest of the app's date handling.
const tickFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function shortTick(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return tickFormat.format(new Date(Date.UTC(year, month - 1, day)))
}

// Readable label for the window's date range, e.g. "11 June 2026 – 17 June 2026".
const rangeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatRange(dates: string[]): string {
  const toLabel = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return rangeFormat.format(new Date(Date.UTC(year, month - 1, day)))
  }
  return `${toLabel(dates[0])} – ${toLabel(dates[dates.length - 1])}`
}

type WeeklyReportProps = {
  loggedFoods: FoodEntry[]
  goalHistory: GoalChange[]
  // The day the rolling window ends on. Defaults to the real current date;
  // injectable so tests pin a known day instead of the live clock.
  today?: string
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

// Slice labels like "Lunch 60%". Uses Recharts' own label props — `name` (our
// nameKey, the meal) and `percent` (the slice's 0–1 fraction) — rather than the
// datum's own `percent` field, which Recharts' computed `percent` would shadow.
function renderSliceLabel(props: { name?: string; percent?: number }): string {
  return `${props.name} ${Math.round((props.percent ?? 0) * 100)}%`
}

/**
 * The Weekly report (Optimization view): a rolling 7-day window of macro trends,
 * a protein-goal streak, daily fiber vs. goal, and the week's calorie split by
 * meal. All figures derive from the shared food log and the effective-dated
 * goals — the protein streak and fiber target read the goal in effect on each
 * day, so editing goals on the Goals tab flows straight through here.
 */
function WeeklyReport({ loggedFoods, goalHistory, today = todayIso() }: WeeklyReportProps) {
  const [endDate, setEndDate] = useState(today)

  const dates = useMemo(() => weekWindow(endDate), [endDate])
  const macroData = useMemo(() => dailyMacroSeries(loggedFoods, dates), [loggedFoods, dates])
  const streak = useMemo(
    () => proteinStreak(loggedFoods, goalHistory, dates),
    [loggedFoods, goalHistory, dates],
  )
  const fiberData = useMemo(
    () => fiberSeries(loggedFoods, goalHistory, dates),
    [loggedFoods, goalHistory, dates],
  )
  const mealData = useMemo(() => mealCalorieBreakdown(loggedFoods, dates), [loggedFoods, dates])

  // Targets shown in the headings come from the goal in effect on the window's
  // latest day, matching what the streak/fiber charts judge against.
  const latestDate = dates[dates.length - 1]
  const proteinGoal = goalsForDate(goalHistory, latestDate).protein
  const fiberGoal = goalsForDate(goalHistory, latestDate).fiber
  const allHit = streak.daysHit === streak.total
  const hasCalories = mealData.some((m) => m.calories > 0)
  const visibleSlices = mealData.filter((m) => m.calories > 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Weekly report</h1>
          <p className="text-sm text-slate-500">{formatRange(dates)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setEndDate((d) => addDays(d, -7))}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setEndDate((d) => addDays(d, 7))}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setEndDate(today)}
            className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
          >
            This week
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Macro consistency: protein / carbs / fat across the 7 days */}
        <section aria-label="Macro consistency" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Macro consistency</h2>
          <p className="mb-4 text-sm text-slate-500">
            Protein, carbs and fat (g) per day — spot weekday vs. weekend drift.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={macroData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={shortTick} fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" />
                <Tooltip labelFormatter={(iso) => shortTick(String(iso))} />
                <Legend />
                <Line type="monotone" dataKey="protein" name="Protein" stroke={MACRO_COLORS.protein} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="carbs" name="Carbs" stroke={MACRO_COLORS.carbs} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fat" name="Fat" stroke={MACRO_COLORS.fat} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Protein streak tracker */}
        <section aria-label="Protein streak" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Protein streak</h2>
          <p className="text-sm text-slate-500">Days hitting your {proteinGoal} g protein goal.</p>
          <p className={`mt-3 text-4xl font-bold ${allHit ? 'text-emerald-600' : 'text-slate-900'}`}>
            {streak.daysHit}
            <span className="text-2xl font-medium text-slate-400"> / {streak.total}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Longest run:{' '}
            <span className="font-medium text-slate-700">
              {streak.longestStreak} day{streak.longestStreak === 1 ? '' : 's'}
            </span>
          </p>
          {/* Per-day pips, oldest → newest: green when that day met its goal */}
          <div className="mt-4 flex gap-1.5">
            {macroData.map((day) => {
              const hit = day.protein >= goalsForDate(goalHistory, day.date).protein
              return (
                <span
                  key={day.date}
                  title={`${shortTick(day.date)}: ${day.protein} g`}
                  className={`h-8 flex-1 rounded ${hit ? 'bg-emerald-500' : 'bg-slate-200'}`}
                />
              )
            })}
          </div>
        </section>

        {/* Fiber vs goal */}
        <section aria-label="Fiber vs goal" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Fiber vs goal</h2>
          <p className="mb-4 text-sm text-slate-500">Daily fiber (g) against your {fiberGoal} g target.</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fiberData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={shortTick} fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" />
                <Tooltip labelFormatter={(iso) => shortTick(String(iso))} />
                <ReferenceLine y={fiberGoal} stroke="#16a34a" strokeDasharray="4 4" />
                <Bar dataKey="fiber" name="Fiber" radius={[4, 4, 0, 0]}>
                  {fiberData.map((day) => (
                    <Cell key={day.date} fill={day.fiber >= day.goal ? '#16a34a' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Meal calorie breakdown */}
        <section aria-label="Meal breakdown" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Where your calories go</h2>
          <p className="mb-4 text-sm text-slate-500">Share of the week's calories by meal.</p>
          {hasCalories ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleSlices}
                    dataKey="calories"
                    nameKey="mealType"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderSliceLabel}
                  >
                    {visibleSlices.map((slice) => (
                      <Cell key={slice.mealType} fill={MEAL_COLORS[slice.mealType]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} kcal`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No calories logged this week.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default WeeklyReport
