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

/** Starting macro goals, used to seed the log on a first-ever (empty-storage) load. */
export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  fat: 75,
  carbs: 130,
  fiber: 30,
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
