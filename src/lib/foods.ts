// Typed accessor + normaliser over the reference-foods JSON.
// Framework-free so it can be unit-tested in isolation, like nutrition.ts and dates.ts.

import proteinSources from '../data/proteinSources.json'

// One reference food as stored in the JSON. Macro values are strings because the
// source data mixes integers, decimals, ranges ("100-110") and a "<1" sentinel.
export type FoodReference = {
  food: string
  serving_size: string
  protein_g: string
  carbs_g: string
  calories_kcal: string
}

/**
 * Coerce a raw macro string from the JSON into a usable number.
 * - "<1" (negligible) rounds up to 1, so it never reads as nothing.
 * - A range ("100-110", "0-1") takes the lower bound — the conservative estimate.
 * - Plain integers and decimals pass straight through.
 * - Anything blank or unparseable falls back to 0.
 */
export function normaliseMacro(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed === '') return 0

  if (trimmed.startsWith('<')) {
    const value = Number(trimmed.slice(1))
    return Number.isFinite(value) ? value : 0
  }

  // Ranges like "100-110" — keep the part before the dash (the lower bound).
  const lower = trimmed.includes('-') ? trimmed.split('-')[0] : trimmed
  const value = Number(lower)
  return Number.isFinite(value) ? value : 0
}

// The JSON keyed by category, e.g. foodCategories['Dairy/Eggs'].
export const foodCategories: Record<string, FoodReference[]> =
  proteinSources as Record<string, FoodReference[]>
