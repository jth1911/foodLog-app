import { useMemo, useState } from 'react'
import {
  MACRO_KEYS,
  MACRO_META,
  MEAL_TYPES,
  goalStatus,
  groupByMeal,
  totalsForDate,
  type FoodEntry,
  type Goals,
  type MacroKey,
} from './lib/nutrition'

// Fixed "today" so seeded data always shows and the UI is deterministic for a mock.
const TODAY = '2026-06-17'

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  fat: 75,
  carbs: 130,
  fiber: 30,
}

// Seed entries across all three meals so the dashboard is populated on first load.
const SEED_FOODS: FoodEntry[] = [
  {
    id: '1',
    date: TODAY,
    week: 25,
    weekday: 'Wednesday',
    mealType: 'Breakfast',
    description: 'Greek yogurt with berries & granola',
    fat: 9,
    carbs: 34,
    protein: 22,
    fiber: 5,
    calories: 320,
  },
  {
    id: '2',
    date: TODAY,
    week: 25,
    weekday: 'Wednesday',
    mealType: 'Breakfast',
    description: 'Black coffee',
    fat: 0,
    carbs: 0,
    protein: 0,
    fiber: 0,
    calories: 5,
  },
  {
    id: '3',
    date: TODAY,
    week: 25,
    weekday: 'Wednesday',
    mealType: 'Lunch',
    description: 'Grilled chicken salad',
    fat: 18,
    carbs: 20,
    protein: 43,
    fiber: 7,
    calories: 430,
  },
  {
    id: '4',
    date: TODAY,
    week: 25,
    weekday: 'Wednesday',
    mealType: 'Dinner',
    description: 'Salmon, quinoa & broccoli',
    fat: 24,
    carbs: 45,
    protein: 40,
    fiber: 9,
    calories: 560,
  },
  {
    id: '5',
    date: TODAY,
    week: 25,
    weekday: 'Wednesday',
    mealType: 'Dinner',
    description: 'Dark chocolate square',
    fat: 7,
    carbs: 13,
    protein: 2,
    fiber: 2,
    calories: 120,
  },
]

const statusClasses: Record<'met' | 'unmet', string> = {
  met: 'text-emerald-600',
  unmet: 'text-rose-600',
}

function Dashboard() {
  const [loggedFoods] = useState<FoodEntry[]>(SEED_FOODS)
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)

  const totals = useMemo(() => totalsForDate(loggedFoods, TODAY), [loggedFoods])
  const grouped = useMemo(() => groupByMeal(loggedFoods.filter((f) => f.date === TODAY)), [loggedFoods])

  const updateGoal = (macro: MacroKey, raw: string) => {
    const value = Number(raw)
    setGoals((prev) => ({ ...prev, [macro]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Food Log</h1>
          <p className="text-sm text-slate-500">Wednesday, 17 June 2026</p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main column: summary + food log */}
          <main className="flex-1 space-y-6">
            {/* Summary card */}
            <section
              aria-label="Daily summary"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Today vs goals</h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {MACRO_KEYS.map((macro) => {
                  const meta = MACRO_META[macro]
                  const consumed = totals[macro]
                  const goal = goals[macro]
                  const status = goalStatus(macro, consumed, goal)
                  return (
                    <div key={macro} className="rounded-lg bg-slate-50 p-3 text-center">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {meta.label}
                      </dt>
                      <dd className={`mt-1 text-lg font-semibold ${statusClasses[status]}`}>
                        <span aria-label={`${meta.label} consumed`}>{consumed}</span>
                        <span className="text-slate-400"> / {goal}</span>
                        {meta.unit !== 'kcal' && (
                          <span className="text-xs text-slate-400"> {meta.unit}</span>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>

            {/* Food log grouped by meal */}
            <section
              aria-label="Food log"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Food log</h2>
              <div className="space-y-5">
                {MEAL_TYPES.map((meal) => {
                  const items = grouped[meal]
                  return (
                    <div key={meal}>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        {meal}
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-sm italic text-slate-400">Nothing logged yet.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between py-2 text-sm"
                            >
                              <span className="text-slate-700">{item.description}</span>
                              <span className="flex gap-3 text-xs text-slate-500">
                                <span>{item.calories} kcal</span>
                                <span>P {item.protein}</span>
                                <span>F {item.fat}</span>
                                <span>C {item.carbs}</span>
                                <span>Fb {item.fiber}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </main>

          {/* Goals side panel */}
          <aside
            aria-label="Goals"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-64"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Goals</h2>
            <div className="space-y-3">
              {MACRO_KEYS.map((macro) => {
                const meta = MACRO_META[macro]
                const arrow = meta.direction === 'min' ? '≥' : '≤'
                return (
                  <label key={macro} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">
                      {meta.label} <span className="text-slate-400">{arrow}</span>
                    </span>
                    <input
                      type="number"
                      aria-label={`${meta.label} goal`}
                      value={goals[macro]}
                      onChange={(e) => updateGoal(macro, e.target.value)}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
