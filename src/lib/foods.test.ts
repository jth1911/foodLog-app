import { describe, it, expect } from 'vitest'
import { foodCategories, normaliseMacro, roundMacro, scaleMacros, type FoodReference } from './foods'
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
