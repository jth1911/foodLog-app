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
  proteinByFoodGroup,
  proteinStreak,
  weekWindow,
} from './lib/weekly'
import { buildFoodCategoryIndex, type UserFoodReference } from './lib/foods'
import { weightSeries, TREND_WINDOW, type WeightEntry } from './lib/weight'
import {
  fluidSeries,
  fluidByTypeSeries,
  activeDrinkTypes,
  type DrinkType,
  type FluidEntry,
} from './lib/fluid'
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

// Distinct hues per food-group category for the protein-source pie. Falls back
// to slate for any non-canonical category the library introduces.
const PROTEIN_SOURCE_COLORS: Record<string, string> = {
  'Dairy/Eggs': '#2563eb',
  'Meat/Poultry': '#dc2626',
  Seafood: '#0891b2',
  Vegetables: '#16a34a',
  Legumes: '#9333ea',
  'Whole Grains': '#d97706',
  'Nuts/Seeds': '#a16207',
  Supplements: '#db2777',
  Other: '#64748b',
}

// Distinct hues for the three macro trend lines.
const MACRO_COLORS = {
  protein: '#16a34a',
  carbs: '#2563eb',
  fat: '#d97706',
}

// Weight line vs its smoothed trend, and the target reference line.
const WEIGHT_COLOR = '#0f172a'
const WEIGHT_TREND_COLOR = '#94a3b8'
const TARGET_COLOR = '#dc2626'

// Fluid-intake bars: a hydration-blue fill, hitting the goal turns them deeper.
const FLUID_COLOR = '#0ea5e9'
const FLUID_MET_COLOR = '#0369a1'

// A distinct hue per drink type for the by-type comparison lines.
const DRINK_COLORS: Record<DrinkType, string> = {
  Water: '#0ea5e9',
  Coffee: '#92400e',
  Tea: '#16a34a',
  Juice: '#f59e0b',
  Soda: '#dc2626',
  Milk: '#64748b',
  Other: '#9333ea',
}

// A y-axis domain that snugly fits the weight values (and the target line when
// set), padded a couple of pounds so the line isn't flush against the edges.
// Falls back to a unit range when there's nothing to plot.
function weightDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  return [Math.floor(Math.min(...values) - 2), Math.ceil(Math.max(...values) + 2)]
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
  // The user-managed food library, keyed by category. Used to map each logged
  // entry's free-text description back to its food group for the protein pie.
  // Optional (defaults to empty) so callers/tests without a library still work.
  foods?: Record<string, UserFoodReference[]>
  // The daily weight log (carry-forward already materialised) and the optional
  // target weight, for the weight-trend chart. Default empty/null so callers and
  // tests that don't care about weight still work.
  weights?: WeightEntry[]
  targetWeight?: number | null
  // The daily fluid log and the optional daily fluid target, for the fluid-intake
  // chart. Default empty/null so callers that don't track fluids still work.
  fluids?: FluidEntry[]
  targetFluid?: number | null
  // The day the rolling window ends on. Defaults to the real current date;
  // injectable so tests pin a known day instead of the live clock.
  today?: string
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

// Slice labels like "Lunch 60%". Uses Recharts' own label props — `name` (our
// nameKey, the meal) and `percent` (the slice's 0–1 fraction). The datum's own
// share field is named `share`, not `percent`, so it can't shadow this value.
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
function WeeklyReport({
  loggedFoods,
  goalHistory,
  foods = {},
  weights = [],
  targetWeight = null,
  fluids = [],
  targetFluid = null,
  today = todayIso(),
}: WeeklyReportProps) {
  const [endDate, setEndDate] = useState(today)

  const dates = useMemo(() => weekWindow(endDate), [endDate])
  const weightData = useMemo(() => weightSeries(weights, dates), [weights, dates])
  const fluidData = useMemo(() => fluidSeries(fluids, dates), [fluids, dates])
  const fluidTypeData = useMemo(() => fluidByTypeSeries(fluids, dates), [fluids, dates])
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
  const categoryIndex = useMemo(() => buildFoodCategoryIndex(foods), [foods])
  const proteinSourceData = useMemo(
    () => proteinByFoodGroup(loggedFoods, dates, categoryIndex),
    [loggedFoods, dates, categoryIndex],
  )

  // Targets shown in the headings come from the goal in effect on the window's
  // latest day, matching what the streak/fiber charts judge against.
  const latestDate = dates[dates.length - 1]
  const proteinGoal = goalsForDate(goalHistory, latestDate).protein
  const fiberGoal = goalsForDate(goalHistory, latestDate).fiber
  const allHit = streak.daysHit === streak.total
  const hasCalories = mealData.some((m) => m.calories > 0)
  const visibleSlices = mealData.filter((m) => m.calories > 0)
  const hasProtein = proteinSourceData.some((p) => p.protein > 0)
  const visibleProteinSlices = proteinSourceData.filter((p) => p.protein > 0)
  const hasFluid = fluidData.some((d) => d.oz > 0)
  const activeTypes = activeDrinkTypes(fluidTypeData)
  const hasWeight = weightData.some((d) => d.lb != null)
  const weightValues = weightData
    .map((d) => d.lb)
    .filter((v): v is number => v != null)
  const yDomain = weightDomain(targetWeight != null ? [...weightValues, targetWeight] : weightValues)

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
        {/* Weight trend: daily weight with a smoothed moving average + target */}
        <section aria-label="Weight trend" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Weight trend</h2>
          <p className="mb-4 text-sm text-slate-500">
            Daily weight (lb) with a {TREND_WINDOW}-day average
            {targetWeight != null ? ` and your ${targetWeight} lb target` : ''}.
          </p>
          {hasWeight ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={shortTick} fontSize={12} stroke="#94a3b8" />
                  <YAxis domain={yDomain} fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip labelFormatter={(iso) => shortTick(String(iso))} />
                  <Legend />
                  {targetWeight != null && (
                    <ReferenceLine y={targetWeight} stroke={TARGET_COLOR} strokeDasharray="4 4" />
                  )}
                  <Line type="monotone" dataKey="lb" name="Weight" stroke={WEIGHT_COLOR} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="trend" name={`${TREND_WINDOW}-day avg`} stroke={WEIGHT_TREND_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No weight logged this week.</p>
          )}
        </section>

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

        {/* Daily fluid intake vs the hydration goal */}
        <section aria-label="Fluid intake" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Fluid intake</h2>
          <p className="mb-4 text-sm text-slate-500">
            Daily fluid (fl oz)
            {targetFluid != null ? ` against your ${targetFluid} fl oz target` : ''}.
          </p>
          {hasFluid ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluidData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={shortTick} fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={12} stroke="#94a3b8" />
                  <Tooltip
                    labelFormatter={(iso) => shortTick(String(iso))}
                    formatter={(value) => [`${value} fl oz`, 'Fluid']}
                  />
                  {targetFluid != null && (
                    <ReferenceLine y={targetFluid} stroke={FLUID_MET_COLOR} strokeDasharray="4 4" />
                  )}
                  <Bar dataKey="oz" name="Fluid" radius={[4, 4, 0, 0]}>
                    {fluidData.map((day) => (
                      <Cell
                        key={day.date}
                        fill={targetFluid != null && day.oz >= targetFluid ? FLUID_MET_COLOR : FLUID_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No fluid logged this week.</p>
          )}
        </section>

        {/* Fluid by type: one line per drink type, to compare water/coffee/tea/… */}
        <section aria-label="Fluid by type" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Fluid by type</h2>
          <p className="mb-4 text-sm text-slate-500">
            Daily fl oz per drink type — compare water vs coffee vs tea and the rest.
          </p>
          {activeTypes.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fluidTypeData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={shortTick} fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={12} stroke="#94a3b8" />
                  <Tooltip
                    labelFormatter={(iso) => shortTick(String(iso))}
                    formatter={(value, name) => [`${value} fl oz`, name]}
                  />
                  <Legend />
                  {activeTypes.map((type) => (
                    <Line
                      key={type}
                      type="monotone"
                      dataKey={type}
                      name={type}
                      stroke={DRINK_COLORS[type]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              No fluid logged this week to compare.
            </p>
          )}
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

        {/* Protein source breakdown by food group */}
        <section aria-label="Protein sources" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Where your protein comes from</h2>
          <p className="mb-4 text-sm text-slate-500">Share of the week's protein by food group.</p>
          {hasProtein ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleProteinSlices}
                    dataKey="protein"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderSliceLabel}
                  >
                    {visibleProteinSlices.map((slice) => (
                      <Cell
                        key={slice.category}
                        fill={PROTEIN_SOURCE_COLORS[slice.category] ?? '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} g`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No protein logged this week.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default WeeklyReport
