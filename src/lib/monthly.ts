// Pure aggregation logic for the Monthly report. Builds the per-day calorie
// heatmap series, the month's most-frequent foods, and the aggregate macro
// ratio — all derived from the same food-log entries and effective-dated goals
// the rest of the app already uses. Framework-free so it can be unit-tested in
// isolation, mirroring weekly.ts.

import {
  goalsForDate,
  totalsForDate,
  type FoodEntry,
  type GoalChange,
} from './nutrition'
import { roundMacro } from './foods'

// Half-width of the "in range" calorie band, as a fraction of the day's calorie
// goal. The goal is treated as the midpoint, so floor = goal × (1 − band) and
// ceiling = goal × (1 + band). A ±10% band gives a 20% green window centred on
// the target.
export const CALORIE_BAND = 0.1

// How a day's calorie intake sits against its goal band. 'empty' is distinct
// from 'under' so a day with no log entries renders neutral, not as starvation.
export type CalorieStatus = 'empty' | 'under' | 'in-range' | 'over'

export type HeatmapDay = {
  date: string
  calories: number
  // Number of log entries that day, so the cell can tell "no food logged"
  // (empty) apart from "logged but zero calories".
  entryCount: number
  status: CalorieStatus
}

/**
 * Per-day calorie totals across the month, each classified against the calorie
 * goal *in effect on that day* (so an effective-dated goal change mid-month is
 * respected). A day with no entries is 'empty' (neutral); otherwise it is
 * 'under' below the floor, 'over' above the ceiling, or 'in-range' between them.
 */
export function calorieHeatmap(
  entries: FoodEntry[],
  goalHistory: GoalChange[],
  dates: string[],
): HeatmapDay[] {
  // One pass to count entries per date, so an all-zero-calorie logged day still
  // reads as logged rather than empty.
  const countByDate = new Map<string, number>()
  for (const food of entries) {
    countByDate.set(food.date, (countByDate.get(food.date) ?? 0) + 1)
  }
  return dates.map((date) => {
    const calories = totalsForDate(entries, date).calories
    const entryCount = countByDate.get(date) ?? 0
    const goal = goalsForDate(goalHistory, date).calories
    const floor = goal * (1 - CALORIE_BAND)
    const ceiling = goal * (1 + CALORIE_BAND)
    let status: CalorieStatus
    if (entryCount === 0) status = 'empty'
    else if (calories < floor) status = 'under'
    else if (calories > ceiling) status = 'over'
    else status = 'in-range'
    return { date, calories, entryCount, status }
  })
}

export type TopFood = {
  // The description as first seen in the window, preserving its original casing.
  description: string
  // How many entries share this description (case-insensitively) in the window.
  count: number
}

/**
 * The `limit` most-logged food descriptions across the month, ranked by entry
 * count descending. Matching is case-insensitive (trimmed + lower-cased) and
 * aggregates across every meal type. Ties keep first-seen order, so the ranking
 * is stable. The displayed label is the first original-cased spelling seen.
 */
export function topFoods(entries: FoodEntry[], dates: string[], limit = 5): TopFood[] {
  const inWindow = new Set(dates)
  // Keyed by the normalised description; records the count and the first-seen
  // label so display casing is stable and order is insertion order.
  const tally = new Map<string, { description: string; count: number }>()
  for (const food of entries) {
    if (!inWindow.has(food.date)) continue
    const key = food.description.trim().toLowerCase()
    const existing = tally.get(key)
    if (existing) existing.count++
    else tally.set(key, { description: food.description, count: 1 })
  }
  // Map preserves insertion order, so a stable sort on count alone keeps
  // first-seen order among ties.
  return [...tally.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

export type MacroRatioSlice = {
  macro: 'protein' | 'carbs' | 'fat'
  grams: number
  // Share of the month's protein+carbs+fat grams, as a whole-number percent
  // (0 when nothing is logged). Named `share` (not `percent`) so it can't shadow
  // Recharts' own computed `percent` when the datum is spread onto a Pie label.
  share: number
}

/**
 * The month's overall protein / carbs / fat split, each as total grams plus its
 * whole-number percent share of the three-macro total. Always returns all three
 * slices (even at 0g) so the donut's colours and legend stay stable. Fiber is
 * excluded — the ratio is the classic energy-macro split, matching the Weekly
 * report's macro styling.
 */
export function monthlyMacroRatio(entries: FoodEntry[], dates: string[]): MacroRatioSlice[] {
  const inWindow = new Set(dates)
  const grams = { protein: 0, carbs: 0, fat: 0 }
  for (const food of entries) {
    if (!inWindow.has(food.date)) continue
    grams.protein += food.protein
    grams.carbs += food.carbs
    grams.fat += food.fat
  }
  const total = grams.protein + grams.carbs + grams.fat
  return (['protein', 'carbs', 'fat'] as const).map((macro) => ({
    macro,
    grams: roundMacro(grams[macro]),
    share: total === 0 ? 0 : Math.round((grams[macro] / total) * 100),
  }))
}
