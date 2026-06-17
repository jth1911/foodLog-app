// Pure, framework-free nutrition logic for the dashboard.
// Kept separate from the component so it can be unit-tested in isolation.

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'

export type FoodEntry = {
  id: string
  date: string // ISO date, e.g. "2026-06-17"
  week: number
  weekday: string // e.g. "Wednesday"
  mealType: MealType
  description: string
  fat: number // grams
  carbs: number // grams
  protein: number // grams
  fiber: number // grams
  calories: number
  // Present only for entries logged from the Foods page with a scaled quantity.
  // The macros above are the scaled totals; these record what they were scaled
  // from so the row can show e.g. "2 × 1 large". Optional for backwards-compat.
  servingSize?: string // the reference serving, read-only (e.g. "1 large")
  quantity?: number // how many of that serving were logged
}

// The numeric fields we total and compare against goals.
export type MacroKey = 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber'

export const MACRO_KEYS: MacroKey[] = ['calories', 'protein', 'fat', 'carbs', 'fiber']

export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

// 'min'    → meet or exceed the goal (e.g. protein ≥ 120)
// 'max'    → stay at or under the goal (e.g. fat ≤ 75, calories as a budget)
// Calories is modelled as a 'max' budget so going over reads as unmet.
type GoalDirection = 'min' | 'max'

export type MacroMeta = {
  label: string
  unit: string
  direction: GoalDirection
}

export const MACRO_META: Record<MacroKey, MacroMeta> = {
  calories: { label: 'Calories', unit: 'kcal', direction: 'max' },
  protein: { label: 'Protein', unit: 'g', direction: 'min' },
  fat: { label: 'Fat', unit: 'g', direction: 'max' },
  carbs: { label: 'Carbs', unit: 'g', direction: 'max' },
  fiber: { label: 'Fiber', unit: 'g', direction: 'min' },
}

export type Totals = Record<MacroKey, number>
export type Goals = Record<MacroKey, number>

// Goals are effective-dated: a goal change applies from its effective date
// forward until the next change. The history is a list of these entries.
export type GoalChange = {
  effectiveDate: string // ISO `YYYY-MM-DD`
  goals: Goals
}

// Sentinel effective date for the seeded/migrated default entry. Sorts before
// any real date, so the default goal extends backward to the start of time and
// every date resolves to a goal — there's never a "no goal" gap.
export const GOALS_EPOCH = '0000-01-01'

/** Starting macro goals, used to seed the log on a first-ever (empty-storage) load. */
export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  fat: 75,
  carbs: 130,
  fiber: 30,
}

/**
 * The goal in effect on `date`: the entry with the latest effective date ≤
 * `date`, or — for a date earlier than every entry — the earliest entry, so
 * goals extend backward in time. Falls back to `DEFAULT_GOALS` only when the
 * history is empty (the store guarantees ≥1 entry in practice).
 *
 * ISO date strings compare lexicographically, so this is a plain string scan.
 * Sorts defensively rather than trusting callers to pass a sorted list.
 */
export function goalsForDate(history: GoalChange[], date: string): Goals {
  if (history.length === 0) return DEFAULT_GOALS
  const sorted = [...history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  let active = sorted[0] // earliest, so dates before the first still resolve
  for (const entry of sorted) {
    if (entry.effectiveDate <= date) active = entry
    else break
  }
  return active.goals
}

/** Sum each macro across the entries logged on `date`. */
export function totalsForDate(foods: FoodEntry[], date: string): Totals {
  const totals: Totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
  for (const food of foods) {
    if (food.date !== date) continue
    for (const key of MACRO_KEYS) totals[key] += food[key]
  }
  return totals
}

/** Whether a consumed `value` meets `goal` given the macro's direction. */
export function goalStatus(macro: MacroKey, value: number, goal: number): 'met' | 'unmet' {
  const { direction } = MACRO_META[macro]
  const ok = direction === 'min' ? value >= goal : value <= goal
  return ok ? 'met' : 'unmet'
}

/** Bucket entries by meal type. Always returns all four meal keys. */
export function groupByMeal(foods: FoodEntry[]): Record<MealType, FoodEntry[]> {
  const grouped: Record<MealType, FoodEntry[]> = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }
  for (const food of foods) grouped[food.mealType].push(food)
  return grouped
}
