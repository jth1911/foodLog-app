// Pure aggregation logic for the Weekly report. Builds the per-day series the
// charts render and the streak/breakdown summaries, all derived from the same
// food-log entries and effective-dated goals the rest of the app already uses.
// Framework-free so it can be unit-tested in isolation, like nutrition.ts.

import {
  MEAL_TYPES,
  goalStatus,
  goalsForDate,
  totalsForDate,
  type FoodEntry,
  type GoalChange,
  type MealType,
} from './nutrition'
import { addDays, weekdayOf } from './dates'
import { roundMacro } from './foods'

/**
 * The `days` ISO dates ending at (and including) `endDate`, ascending. Defaults
 * to a 7-day window — the rolling "last 7 days" the report shows. Uses the
 * UTC-safe `addDays` so it normalises across month/year boundaries.
 */
export function weekWindow(endDate: string, days = 7): string[] {
  const window: string[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    window.push(addDays(endDate, -offset))
  }
  return window
}

export type DayMacros = {
  date: string
  weekday: string
  protein: number
  carbs: number
  fat: number
  fiber: number
  calories: number
}

/** Per-day macro totals across the window, one row per date (zeros for empty days). */
export function dailyMacroSeries(entries: FoodEntry[], dates: string[]): DayMacros[] {
  return dates.map((date) => {
    const totals = totalsForDate(entries, date)
    return {
      date,
      weekday: weekdayOf(date),
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber,
      calories: totals.calories,
    }
  })
}

export type StreakResult = {
  // Days in the window whose protein met or exceeded that day's goal.
  daysHit: number
  // Window length, so callers can render "daysHit / total".
  total: number
  // Longest run of consecutive hit days within the window.
  longestStreak: number
}

/**
 * Protein-goal streak across the window. Each day is judged against the protein
 * goal *in effect on that day* (so an effective-dated goal change is respected),
 * reusing the same `goalStatus` rule the dashboard uses.
 */
export function proteinStreak(
  entries: FoodEntry[],
  goalHistory: GoalChange[],
  dates: string[],
): StreakResult {
  let daysHit = 0
  let longestStreak = 0
  let current = 0
  for (const date of dates) {
    const protein = totalsForDate(entries, date).protein
    const goal = goalsForDate(goalHistory, date).protein
    if (goalStatus('protein', protein, goal) === 'met') {
      daysHit++
      current++
      longestStreak = Math.max(longestStreak, current)
    } else {
      current = 0
    }
  }
  return { daysHit, total: dates.length, longestStreak }
}

export type FiberDay = {
  date: string
  weekday: string
  fiber: number
  goal: number
}

/** Per-day fiber total paired with that day's fiber goal, for the bar chart. */
export function fiberSeries(
  entries: FoodEntry[],
  goalHistory: GoalChange[],
  dates: string[],
): FiberDay[] {
  return dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    fiber: totalsForDate(entries, date).fiber,
    goal: goalsForDate(goalHistory, date).fiber,
  }))
}

export type MealSlice = {
  mealType: MealType
  calories: number
  // Share of the window's total calories, rounded to a whole percent (0 when
  // there are no calories at all). Named `share` rather than `percent` so it
  // can't shadow Recharts' own computed `percent` when the datum is spread onto
  // a Pie label's render props.
  share: number
}

/**
 * Total calories per meal type across the window, with each meal's share of the
 * total as a whole-number percent. Always returns all four meals so the pie's
 * legend is stable even when a meal is empty.
 */
export function mealCalorieBreakdown(entries: FoodEntry[], dates: string[]): MealSlice[] {
  const inWindow = new Set(dates)
  const caloriesByMeal: Record<MealType, number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snacks: 0,
  }
  for (const food of entries) {
    if (!inWindow.has(food.date)) continue
    caloriesByMeal[food.mealType] += food.calories
  }
  const total = MEAL_TYPES.reduce((sum, meal) => sum + caloriesByMeal[meal], 0)
  return MEAL_TYPES.map((mealType) => ({
    mealType,
    calories: caloriesByMeal[mealType],
    share: total === 0 ? 0 : Math.round((caloriesByMeal[mealType] / total) * 100),
  }))
}

// Canonical food-group categories, in the order the pie's legend lists them.
// Mirrors the keys of proteinSources.json plus the catch-all "Other"; the
// breakdown always emits these (even at 0g) so colours and legend stay stable.
export const PROTEIN_SOURCE_CATEGORIES = [
  'Dairy/Eggs',
  'Meat/Poultry',
  'Seafood',
  'Vegetables',
  'Legumes',
  'Whole Grains',
  'Nuts/Seeds',
  'Supplements',
  'Other',
] as const

// Substrings that mark an entry as a protein supplement even when its description
// doesn't match a library food by name — the bulk of "Other" tends to be these.
// Kept specific (multi-word / unambiguous) so a normal food never trips them;
// bare "protein" is deliberately excluded ("high-protein bread" is not a supp).
const SUPPLEMENT_KEYWORDS = [
  'protein powder',
  'protein shake',
  'protein isolate',
  'whey',
  'casein',
  'mass gainer',
]

/**
 * Resolve one entry's `description` to a food group. Exact match against the
 * library index wins, *except* when it resolves to the catch-all "Other": a
 * specific supplement keyword then upgrades it to "Supplements" (so a protein
 * powder filed under "Other", or typed free-text, still lands there). An
 * explicit non-"Other" category the user chose is always respected.
 */
export function resolveFoodGroup(description: string, categoryIndex: Map<string, string>): string {
  const key = description.trim().toLowerCase()
  const exact = categoryIndex.get(key)
  if (exact && exact !== 'Other') return exact
  if (SUPPLEMENT_KEYWORDS.some((keyword) => key.includes(keyword))) return 'Supplements'
  return exact ?? 'Other'
}

export type ProteinSourceSlice = {
  category: string
  protein: number
  // Share of the window's total protein, rounded to a whole percent (0 when no
  // protein at all). Named `share` (not `percent`) for the same reason as
  // MealSlice — so it can't shadow Recharts' computed `percent` in a pie label.
  share: number
}

/**
 * Total protein per food-group category across the window, with each category's
 * share of the total as a whole-number percent. Mirrors mealCalorieBreakdown.
 *
 * `FoodEntry.description` carries no category, so each entry's description is
 * matched against `categoryIndex` — the live food library keyed by name (see
 * buildFoodCategoryIndex) — via resolveFoodGroup, which also keyword-classifies
 * supplements and falls back to "Other". Always returns the canonical categories
 * (plus any extra ones the library introduced, appended) so total protein is
 * conserved and the legend is stable even when a category is empty.
 */
export function proteinByFoodGroup(
  entries: FoodEntry[],
  dates: string[],
  categoryIndex: Map<string, string>,
): ProteinSourceSlice[] {
  const inWindow = new Set(dates)
  const proteinByCategory = new Map<string, number>()
  for (const food of entries) {
    if (!inWindow.has(food.date)) continue
    const category = resolveFoodGroup(food.description, categoryIndex)
    proteinByCategory.set(category, (proteinByCategory.get(category) ?? 0) + food.protein)
  }
  // Canonical order first, then any library categories outside the canonical set.
  const categories: string[] = [...PROTEIN_SOURCE_CATEGORIES]
  for (const category of proteinByCategory.keys()) {
    if (!categories.includes(category)) categories.push(category)
  }
  const total = [...proteinByCategory.values()].reduce((sum, protein) => sum + protein, 0)
  return categories.map((category) => {
    const protein = roundMacro(proteinByCategory.get(category) ?? 0)
    return {
      category,
      protein,
      share: total === 0 ? 0 : Math.round((protein / total) * 100),
    }
  })
}
