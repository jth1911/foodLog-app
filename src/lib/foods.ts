// Typed accessor + normaliser over the reference-foods JSON.
// Framework-free so it can be unit-tested in isolation, like nutrition.ts and dates.ts.

import proteinSources from '../data/proteinSources.json'
import { MACRO_KEYS, type MacroKey } from './nutrition'

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

/**
 * Round a scaled macro to one decimal place. Keeps partial servings honest
 * (0.5 × 5 = 2.5) while killing float noise (0.1 × 3 = 0.30000000000000004).
 */
export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Scale a per-serving macro set by a quantity, e.g. "2 eggs" doubles each macro.
 * Pure and framework-free, layered on roundMacro so partial servings stay clean.
 */
export function scaleMacros(
  macros: Record<MacroKey, number>,
  quantity: number,
): Record<MacroKey, number> {
  const scaled = {} as Record<MacroKey, number>
  for (const key of MACRO_KEYS) scaled[key] = roundMacro(macros[key] * quantity)
  return scaled
}

// The JSON keyed by category, e.g. foodCategories['Dairy/Eggs'].
export const foodCategories: Record<string, FoodReference[]> =
  proteinSources as Record<string, FoodReference[]>

// A user-managed reference food. Unlike FoodReference (which mirrors the raw
// JSON's mixed macro strings), macros here are already-normalised plain numbers.
// protein/carbs/calories are the tracked-and-required set; fat/fiber are optional
// because the seed data never carried them.
export type UserFoodReference = {
  id: string
  food: string
  serving_size: string
  protein: number
  carbs: number
  calories: number
  fat?: number
  fiber?: number
}

// Unit/descriptor words that don't identify a food, dropped from tokens so a
// library name keys on what matters — "Greek yogurt (non fat, plain)" → greek,
// yogurt; "Chicken Breast (skinless)" → chicken, breast.
const FOOD_NAME_STOPWORDS = new Set([
  'low', 'fat', 'non', 'nonfat', 'plain', 'skinless', 'boneless', 'lean', 'dry',
  'cooked', 'uncooked', 'canned', 'drained', 'green', 'oil', 'shelled', 'light',
  'of', 'in', 'the', 'and', 'with', 'sliced', 'deli', 'firm', 'raw', 'whole',
  'organic', 'grass', 'fed',
])

/**
 * Significant lower-cased tokens of a food name, for forgiving matching: drop
 * parentheticals and unit/descriptor stopwords, split on non-alphanumerics,
 * crudely singularise (seeds → seed) and keep tokens of 3+ chars. So "Chia
 * Seeds" → ["chia", "seed"], and a verbose entry like "Stonyfield Organic Greek
 * Plain Nonfat Yogurt" shares ["greek", "yogurt"] with the library's "Greek
 * yogurt (non fat, plain)". Word-boundary based, so "egg" never matches
 * "eggplant".
 */
export function tokenizeFoodName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word))
    .filter((word) => word.length >= 3 && !FOOD_NAME_STOPWORDS.has(word))
}

// A searchable view of the live food library, keyed by food name → category.
export type FoodCategoryIndex = {
  // Normalised full name → category, for an exact, highest-confidence hit. When
  // the same name appears in two categories the last one wins — a tolerated edge.
  exact: Map<string, string>
  // Per library food: its category and significant name tokens, for token-subset
  // matching. Sorted most-specific (most tokens) first so a description that
  // matches several foods resolves to the longest, most precise one.
  tokenized: { category: string; tokens: string[] }[]
}

/**
 * Index the live, user-managed library (not the static JSON, so foods the user
 * added on the Foods page categorise too) for both exact and token matching —
 * see resolveFoodGroup, which uses it to map a free-text entry description back
 * to its food group.
 */
export function buildFoodCategoryIndex(
  foods: Record<string, UserFoodReference[]>,
): FoodCategoryIndex {
  const exact = new Map<string, string>()
  const tokenized: { category: string; tokens: string[] }[] = []
  for (const [category, list] of Object.entries(foods)) {
    for (const food of list) {
      exact.set(food.food.trim().toLowerCase(), category)
      const tokens = tokenizeFoodName(food.food)
      if (tokens.length) tokenized.push({ category, tokens })
    }
  }
  tokenized.sort((a, b) => b.tokens.length - a.tokens.length)
  return { exact, tokenized }
}

/**
 * Build the first-run reference library from the static JSON: each food's mixed
 * macro strings are normalised to numbers and stamped with a stable id. Runs once
 * to seed localStorage (see useFoodLog); thereafter the stored copy is the source
 * of truth and the JSON is only this seed.
 */
export function seedFoodsFromJson(): Record<string, UserFoodReference[]> {
  const seeded: Record<string, UserFoodReference[]> = {}
  let n = 0
  for (const [category, foods] of Object.entries(foodCategories)) {
    seeded[category] = foods.map((food) => ({
      id: `seed-${n++}`,
      food: food.food,
      serving_size: food.serving_size,
      protein: normaliseMacro(food.protein_g),
      carbs: normaliseMacro(food.carbs_g),
      calories: normaliseMacro(food.calories_kcal),
    }))
  }
  return seeded
}
