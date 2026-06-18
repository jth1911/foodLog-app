import { describe, it, expect } from 'vitest'
import {
  buildFoodCategoryIndex,
  foodCategories,
  normaliseMacro,
  roundMacro,
  scaleMacros,
  seedFoodsFromJson,
  tokenizeFoodName,
  type FoodReference,
  type UserFoodReference,
} from './foods'
import { MACRO_KEYS } from './nutrition'

describe('normaliseMacro', () => {
  it('parses plain integers and decimals', () => {
    expect(normaliseMacro('24')).toBe(24)
    expect(normaliseMacro('3.5')).toBe(3.5)
    expect(normaliseMacro('0')).toBe(0)
  })

  it('rounds the "<1" sentinel up to 1', () => {
    expect(normaliseMacro('<1')).toBe(1)
  })

  it('takes the lower bound of a range', () => {
    expect(normaliseMacro('100-110')).toBe(100)
    expect(normaliseMacro('20-35')).toBe(20)
    expect(normaliseMacro('0-1')).toBe(0)
    expect(normaliseMacro('18-22')).toBe(18)
  })

  it('falls back to 0 for blank or unparseable input', () => {
    expect(normaliseMacro('')).toBe(0)
    expect(normaliseMacro('   ')).toBe(0)
    expect(normaliseMacro('n/a')).toBe(0)
  })
})

describe('roundMacro', () => {
  it('rounds to one decimal place', () => {
    expect(roundMacro(2.5)).toBe(2.5)
    expect(roundMacro(3)).toBe(3)
    expect(roundMacro(2.04)).toBe(2)
    expect(roundMacro(2.05)).toBeCloseTo(2.1)
  })

  it('kills floating-point noise', () => {
    // 0.1 * 3 is 0.30000000000000004 without rounding.
    expect(roundMacro(0.1 * 3)).toBe(0.3)
  })
})

describe('scaleMacros', () => {
  const base = { calories: 70, protein: 6, fat: 5, carbs: 1, fiber: 0 }

  it('is the identity for quantity 1', () => {
    expect(scaleMacros(base, 1)).toEqual(base)
  })

  it('doubles every macro for quantity 2', () => {
    expect(scaleMacros(base, 2)).toEqual({
      calories: 140,
      protein: 12,
      fat: 10,
      carbs: 2,
      fiber: 0,
    })
  })

  it('halves for quantity 0.5, keeping non-integer results', () => {
    expect(scaleMacros(base, 0.5)).toEqual({
      calories: 35, // 0.5 * 70
      protein: 3, //   0.5 * 6
      fat: 2.5, //     0.5 * 5  → non-integer, preserved
      carbs: 0.5, //   0.5 * 1
      fiber: 0,
    })
  })

  it('scales all five macro keys', () => {
    const scaled = scaleMacros(base, 3)
    for (const key of MACRO_KEYS) expect(scaled[key]).toBe(roundMacro(base[key] * 3))
  })
})

describe('foodCategories', () => {
  it('exposes every category as a non-empty array of food references', () => {
    const keys = Object.keys(foodCategories)
    expect(keys).toEqual(
      expect.arrayContaining([
        'Dairy/Eggs',
        'Meat/Poultry',
        'Seafood',
        'Vegetables',
        'Legumes',
        'Nuts/Seeds',
        'Other',
      ]),
    )
    for (const list of Object.values(foodCategories)) {
      expect(Array.isArray(list)).toBe(true)
      expect(list.length).toBeGreaterThan(0)
    }
  })

  it('gives each entry a food name and serving size', () => {
    const all: FoodReference[] = Object.values(foodCategories).flat()
    for (const food of all) {
      expect(typeof food.food).toBe('string')
      expect(food.food.length).toBeGreaterThan(0)
      expect(typeof food.serving_size).toBe('string')
    }
  })
})

describe('seedFoodsFromJson', () => {
  it('keeps every category from the JSON', () => {
    const seeded = seedFoodsFromJson()
    expect(Object.keys(seeded)).toEqual(Object.keys(foodCategories))
  })

  it('normalises macro strings to plain numbers', () => {
    const seeded = seedFoodsFromJson()
    // "Egg" → protein 6, carbs 1, calories 70; all numbers, not strings.
    const egg = seeded['Dairy/Eggs'].find((f) => f.food === 'Egg')!
    expect(egg).toMatchObject({ serving_size: '1 large', protein: 6, carbs: 1, calories: 70 })
    for (const key of ['protein', 'carbs', 'calories'] as const) {
      expect(typeof egg[key]).toBe('number')
    }
  })

  it('applies the range and "<1" rules from normaliseMacro', () => {
    const seeded = seedFoodsFromJson()
    // String cheese carbs "<1" → 1; non-fat milk calories "80-90" → lower bound 80.
    const cheese = seeded['Dairy/Eggs'].find((f) => f.food === 'String cheese (low fat)')!
    expect(cheese.carbs).toBe(1)
    const milk = seeded['Dairy/Eggs'].find((f) => f.food === 'Non-fat Milk (Skim)')!
    expect(milk.calories).toBe(80)
  })

  it('stamps every food with a unique id', () => {
    const all = Object.values(seedFoodsFromJson()).flat()
    const ids = all.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })
})

describe('buildFoodCategoryIndex', () => {
  const food = (name: string): UserFoodReference => ({
    id: name,
    food: name,
    serving_size: '1',
    protein: 0,
    carbs: 0,
    calories: 0,
  })

  it('maps each food name to its category in the exact index', () => {
    const index = buildFoodCategoryIndex({
      'Dairy/Eggs': [food('Egg')],
      'Meat/Poultry': [food('Chicken breast')],
    })
    expect(index.exact.get('egg')).toBe('Dairy/Eggs')
    expect(index.exact.get('chicken breast')).toBe('Meat/Poultry')
  })

  it('exact keys are trimmed and lower-cased for case-insensitive lookup', () => {
    const index = buildFoodCategoryIndex({ 'Meat/Poultry': [food('  Chicken Breast ')] })
    expect(index.exact.get('chicken breast')).toBe('Meat/Poultry')
  })

  it('last category wins when a name appears twice', () => {
    const index = buildFoodCategoryIndex({
      'Dairy/Eggs': [food('Tofu')],
      Legumes: [food('Tofu')],
    })
    expect(index.exact.get('tofu')).toBe('Legumes')
  })

  it('records tokens per food, most-specific (most tokens) first', () => {
    const index = buildFoodCategoryIndex({
      'Meat/Poultry': [food('Chicken Breast (skinless)')],
      Seafood: [food('Cod')],
    })
    expect(index.tokenized[0]).toEqual({ category: 'Meat/Poultry', tokens: ['chicken', 'breast'] })
    expect(index.tokenized[1]).toEqual({ category: 'Seafood', tokens: ['cod'] })
  })

  it('returns empty exact and tokenized for an empty library', () => {
    const index = buildFoodCategoryIndex({})
    expect(index.exact.size).toBe(0)
    expect(index.tokenized).toEqual([])
  })
})

describe('tokenizeFoodName', () => {
  it('drops parentheticals, descriptors and short words, and singularises', () => {
    expect(tokenizeFoodName('Greek yogurt (non fat, plain)')).toEqual(['greek', 'yogurt'])
    expect(tokenizeFoodName('Chia Seeds')).toEqual(['chia', 'seed'])
    expect(tokenizeFoodName('Chicken Breast (skinless)')).toEqual(['chicken', 'breast'])
  })

  it('shares tokens between a verbose entry and its generic library name', () => {
    const entry = new Set(tokenizeFoodName('Stonyfield Organic Greek Plain Nonfat Yogurt'))
    expect(tokenizeFoodName('Greek yogurt (non fat, plain)').every((t) => entry.has(t))).toBe(true)
  })
})
