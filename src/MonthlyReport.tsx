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
import { type FoodEntry, type GoalChange } from './lib/nutrition'
import {
  macroHeatmap,
  monthlyMacroRatio,
  topFoods,
  type BandStatus,
  type HeatmapDay,
} from './lib/monthly'
import { weightSeries, TREND_WINDOW, type WeightEntry } from './lib/weight'
import { fluidSeries, type FluidEntry } from './lib/fluid'
import { addMonths, monthDays, startOfMonth, todayIso } from './lib/dates'

// A heatmap's presentation. The band classification (under/in-range/over) is
// positional and macro-agnostic, so colours and labels are assigned per macro:
// calories is a budget where finishing under is the win, while protein is a
// target where hitting or exceeding it is — so green/red invert between them.
type HeatmapConfig = {
  ariaLabel: string
  title: string
  description: string
  unit: string
  colors: Record<BandStatus, string>
  labels: Record<BandStatus, string>
  // Legend order, good → bad, so the colour the user wants to see leads.
  legend: BandStatus[]
}

const NEUTRAL = 'bg-slate-100'
const GREEN = 'bg-emerald-500'
const AMBER = 'bg-amber-400'
const RED = 'bg-rose-500'

// Calories — a max budget: comfortably under is green, nearing the goal amber,
// over the ceiling red.
const CALORIE_HEATMAP: HeatmapConfig = {
  ariaLabel: 'Calorie heatmap',
  title: 'Calorie ceiling & floor',
  description:
    'Each logged day against its calorie goal — green is comfortably under, amber nearing it, red over.',
  unit: 'kcal',
  colors: { under: GREEN, 'in-range': AMBER, over: RED, empty: NEUTRAL },
  labels: { under: 'Under', 'in-range': 'Near goal', over: 'Surplus', empty: 'No log' },
  legend: ['under', 'in-range', 'over', 'empty'],
}

// Protein — a target to hit: at/above the goal is green, nearing it amber, well
// under red. Green/red invert relative to calories because more protein is good.
const PROTEIN_HEATMAP: HeatmapConfig = {
  ariaLabel: 'Protein heatmap',
  title: 'Protein ceiling & floor',
  description:
    'Each logged day against its protein goal — green hit the target, amber nearing it, red missed.',
  unit: 'g',
  colors: { over: GREEN, 'in-range': AMBER, under: RED, empty: NEUTRAL },
  labels: { over: 'Hit', 'in-range': 'Near goal', under: 'Missed', empty: 'No log' },
  legend: ['over', 'in-range', 'under', 'empty'],
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

// Weight line vs its smoothed trend, and the target reference line. Mirrors the
// Weekly report so the weight charts read the same across both views.
const WEIGHT_COLOR = '#0f172a'
const WEIGHT_TREND_COLOR = '#94a3b8'
const TARGET_COLOR = '#dc2626'

// Fluid-intake bars: hydration blue, deepening on days that hit the goal.
const FLUID_COLOR = '#0ea5e9'
const FLUID_MET_COLOR = '#0369a1'

// A y-axis domain that snugly fits the weight values (and the target line when
// set), padded a couple of pounds. Falls back to a unit range when empty.
function weightDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  return [Math.floor(Math.min(...values) - 2), Math.ceil(Math.max(...values) + 2)]
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

// A full-month calendar heatmap card: a 7-column grid of day cells coloured by
// each day's band status, with leading blanks so the 1st lines up under its
// weekday, plus a legend. Presentation comes entirely from `config`, so the same
// card renders the calorie and protein heatmaps.
function HeatmapCard({
  days,
  leadingBlanks,
  config,
}: {
  days: HeatmapDay[]
  leadingBlanks: number
  config: HeatmapConfig
}) {
  return (
    <section aria-label={config.ariaLabel} className={`${cardClass} lg:col-span-2`}>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{config.title}</h2>
      <p className="mb-4 text-sm text-slate-500">{config.description}</p>
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
        {days.map((day) => (
          <div
            key={day.date}
            title={
              day.status === 'empty'
                ? `${day.date}: no log`
                : `${day.date}: ${Math.round(day.value)} ${config.unit} — ${config.labels[day.status]}`
            }
            className={`flex aspect-square items-center justify-center rounded text-xs font-medium ${
              config.colors[day.status]
            } ${day.status === 'empty' ? 'text-slate-400' : 'text-white'}`}
          >
            {dayOfMonth(day.date)}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {config.legend.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${config.colors[status]}`} />
            {config.labels[status]}
          </span>
        ))}
      </div>
    </section>
  )
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
  // The daily weight log (carry-forward already materialised) and the optional
  // target weight, for the weight-trend chart. Default empty/null so callers and
  // tests that don't care about weight still work.
  weights?: WeightEntry[]
  targetWeight?: number | null
  // The daily fluid log and the optional daily fluid target, for the fluid-intake
  // chart. Default empty/null so callers that don't track fluids still work.
  fluids?: FluidEntry[]
  targetFluid?: number | null
  // The month to land on (any day within it). Defaults to the real current
  // month; injectable so tests pin a known month instead of the live clock.
  today?: string
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

/**
 * The Monthly report (big-picture view): full-month calendar heatmaps of daily
 * calories and protein against their goal bands, the month's most-frequent
 * foods, and the overall protein/carbs/fat split. All figures derive from the
 * shared food log and the effective-dated goals — each day's heatmap cell is
 * judged against the goal in effect on that day, so editing goals on the Goals
 * tab flows through.
 */
function MonthlyReport({
  loggedFoods,
  goalHistory,
  weights = [],
  targetWeight = null,
  fluids = [],
  targetFluid = null,
  today = todayIso(),
}: MonthlyReportProps) {
  const currentMonth = startOfMonth(today)
  const [month, setMonth] = useState(currentMonth)

  const dates = useMemo(() => monthDays(month), [month])
  const weightData = useMemo(() => weightSeries(weights, dates), [weights, dates])
  const fluidData = useMemo(() => fluidSeries(fluids, dates), [fluids, dates])
  const calorieDays = useMemo(
    () => macroHeatmap(loggedFoods, goalHistory, dates, 'calories'),
    [loggedFoods, goalHistory, dates],
  )
  const proteinDays = useMemo(
    () => macroHeatmap(loggedFoods, goalHistory, dates, 'protein'),
    [loggedFoods, goalHistory, dates],
  )
  const foods = useMemo(() => topFoods(loggedFoods, dates, 10), [loggedFoods, dates])
  const macroData = useMemo(() => monthlyMacroRatio(loggedFoods, dates), [loggedFoods, dates])

  // Forward navigation is clamped at the current month — there's no data ahead.
  const atCurrentMonth = month >= currentMonth
  const leadingBlanks = dates.length > 0 ? weekdayIndex(dates[0]) : 0
  const hasMacros = macroData.some((m) => m.grams > 0)
  const visibleMacros = macroData.filter((m) => m.grams > 0)
  const hasFluid = fluidData.some((d) => d.oz > 0)
  const hasWeight = weightData.some((d) => d.lb != null)
  const weightValues = weightData.map((d) => d.lb).filter((v): v is number => v != null)
  const yDomain = weightDomain(targetWeight != null ? [...weightValues, targetWeight] : weightValues)

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
        {/* Weight trend across the month, with a smoothed average + target */}
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
                  <XAxis
                    dataKey="date"
                    tickFormatter={(iso) => String(dayOfMonth(String(iso)))}
                    fontSize={12}
                    stroke="#94a3b8"
                  />
                  <YAxis domain={yDomain} fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip labelFormatter={(iso) => String(iso)} />
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
            <p className="py-12 text-center text-sm text-slate-400">No weight logged this month.</p>
          )}
        </section>

        {/* Calorie & protein ceiling/floor heatmaps */}
        <HeatmapCard days={calorieDays} leadingBlanks={leadingBlanks} config={CALORIE_HEATMAP} />
        <HeatmapCard days={proteinDays} leadingBlanks={leadingBlanks} config={PROTEIN_HEATMAP} />

        {/* Top 10 most frequent foods */}
        <section aria-label="Top foods" className={cardClass}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Most-logged foods</h2>
          <p className="mb-4 text-sm text-slate-500">Your 10 most frequent foods this month.</p>
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
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 10, bottom: 5, left: 10 }}>
                  <Pie
                    data={visibleMacros}
                    dataKey="grams"
                    nameKey="macro"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
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

        {/* Daily fluid intake across the month vs the hydration goal */}
        <section aria-label="Fluid intake" className={`${cardClass} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Fluid intake</h2>
          <p className="mb-4 text-sm text-slate-500">
            Daily fluid (fl oz)
            {targetFluid != null ? ` against your ${targetFluid} fl oz target` : ''}.
          </p>
          {hasFluid ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluidData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(iso) => String(dayOfMonth(String(iso)))}
                    fontSize={12}
                    stroke="#94a3b8"
                  />
                  <YAxis fontSize={12} stroke="#94a3b8" />
                  <Tooltip
                    labelFormatter={(iso) => String(iso)}
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
            <p className="py-12 text-center text-sm text-slate-400">No fluid logged this month.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default MonthlyReport
