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
