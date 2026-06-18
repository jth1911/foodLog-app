// Pure, framework-free fluid-intake logic. Kept separate from the components so
// the per-day aggregation, the goal rule, and the report series can all be
// unit-tested in isolation — mirroring nutrition.ts and weight.ts.

import { weekdayOf } from './dates'

// The fixed set of drink types a fluid entry can carry, in the order the entry
// form lists them. A small built-in list (not a user-managed library) — the
// counterpart of nutrition.ts's MEAL_TYPES. 'Other' is the catch-all.
export const DRINK_TYPES = ['Water', 'Coffee', 'Tea', 'Juice', 'Soda', 'Milk', 'Other'] as const

export type DrinkType = (typeof DRINK_TYPES)[number]

// A single logged drink. Calories are the only nutrition tracked (caloric drinks
// roll into the day's calorie total alongside food); volume is in fluid ounces.
// Mirrors FoodEntry's id/date/week/weekday stamping so it slots into the same
// day-navigation and report windows.
export type FluidEntry = {
  id: string
  date: string // ISO date, e.g. "2026-06-17"
  week: number
  weekday: string // e.g. "Wednesday"
  drinkType: DrinkType
  oz: number // fluid ounces
  calories: number
}

export type FluidTotals = {
  oz: number
  calories: number
}

/** Sum volume and calories across the drinks logged on `date`. */
export function fluidTotalsForDate(fluids: FluidEntry[], date: string): FluidTotals {
  const totals: FluidTotals = { oz: 0, calories: 0 }
  for (const drink of fluids) {
    if (drink.date !== date) continue
    totals.oz += drink.oz
    totals.calories += drink.calories
  }
  return totals
}

/**
 * Whether the day's `oz` meets the daily fluid `goal`. Fluid is a 'min' target —
 * meet or exceed it — so this mirrors goalStatus for protein/fiber.
 */
export function fluidGoalStatus(oz: number, goal: number): 'met' | 'unmet' {
  return oz >= goal ? 'met' : 'unmet'
}

export type FluidDay = {
  date: string
  weekday: string
  oz: number
}

/** Per-day oz total across `dates`, one row per date (zero for empty days). For
 * the report bar charts; mirrors fiberSeries/dailyMacroSeries in weekly.ts. */
export function fluidSeries(fluids: FluidEntry[], dates: string[]): FluidDay[] {
  return dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    oz: fluidTotalsForDate(fluids, date).oz,
  }))
}
