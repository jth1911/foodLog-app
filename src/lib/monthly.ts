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
  type MacroKey,
} from './nutrition'
import { roundMacro } from './foods'

// Half-width of the "in range" band around a macro goal, as a fraction of that
// day's goal. The goal is treated as the midpoint, so floor = goal × (1 − band)
// and ceiling = goal × (1 + band). A ±10% band gives a 20% window centred on the
// target. Shared by every macro heatmap (calories, protein, …).
export const GOAL_BAND = 0.1

// Where a day's macro intake sits relative to its goal band — purely positional,
// so it's direction-agnostic (the report assigns colours per macro, since
// "under" is good for calories but bad for protein). 'empty' is distinct from
// 'under' so a day with no log entries renders neutral, not as a miss.
export type BandStatus = 'empty' | 'under' | 'in-range' | 'over'

export type HeatmapDay = {
  date: string
  // The day's total for the macro this heatmap tracks (kcal or grams).
  value: number
  // Number of log entries that day, so the cell can tell "no food logged"
  // (empty) apart from "logged but zero of this macro".
  entryCount: number
  status: BandStatus
}

/**
 * Per-day totals for `macro` across the month, each classified against the goal
 * *in effect on that day* (so an effective-dated goal change mid-month is
 * respected). A day with no entries is 'empty' (neutral); otherwise it is
 * 'under' below the floor, 'over' above the ceiling, or 'in-range' between them.
 * Classification is positional only — callers colour the bands per macro.
 */
export function macroHeatmap(
  entries: FoodEntry[],
  goalHistory: GoalChange[],
  dates: string[],
  macro: MacroKey,
): HeatmapDay[] {
  // One pass to count entries per date, so an all-zero logged day still reads as
  // logged rather than empty.
  const countByDate = new Map<string, number>()
  for (const food of entries) {
    countByDate.set(food.date, (countByDate.get(food.date) ?? 0) + 1)
  }
  return dates.map((date) => {
    const value = totalsForDate(entries, date)[macro]
    const entryCount = countByDate.get(date) ?? 0
    const goal = goalsForDate(goalHistory, date)[macro]
    const floor = goal * (1 - GOAL_BAND)
    const ceiling = goal * (1 + GOAL_BAND)
    let status: BandStatus
    if (entryCount === 0) status = 'empty'
    else if (value < floor) status = 'under'
    else if (value > ceiling) status = 'over'
    else status = 'in-range'
    return { date, value, entryCount, status }
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
