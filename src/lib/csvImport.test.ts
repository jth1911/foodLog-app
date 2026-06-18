import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv } from './csvImport'

const HEADER = 'Date,Meal Type,Food Description,Fat,Carbs,Protein,Calories,Fiber'

// Build CSV text from a header plus data rows.
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

describe('parseCsv', () => {
  it('parses a valid row into a ParsedEntry with an ISO date', () => {
    const { valid, errors } = parseCsv(csv('5/27/2026,Breakfast,Greek Yogurt,0,7,16,90,0'))
    expect(errors).toEqual([])
    expect(valid).toEqual([
      {
        date: '2026-05-27',
        mealType: 'Breakfast',
        description: 'Greek Yogurt',
        fat: 0,
        carbs: 7,
        protein: 16,
        calories: 90,
        fiber: 0,
      },
    ])
  })

  it('zero-pads single-digit months and days', () => {
    const { valid } = parseCsv(csv('1/3/2026,Lunch,Egg,5,1,6,70,0'))
    expect(valid[0].date).toBe('2026-01-03')
  })

  it('normalises the singular "Snack" to "Snacks"', () => {
    const { valid } = parseCsv(csv('5/27/2026,Snack,Popcorn,7,10,1,100,1'))
    expect(valid[0].mealType).toBe('Snacks')
  })

  it('normalises meal type case-insensitively', () => {
    const { valid } = parseCsv(csv('5/27/2026,DINNER,Steak,24,0,21,480,0'))
    expect(valid[0].mealType).toBe('Dinner')
  })

  it('accepts decimal macros', () => {
    const { valid } = parseCsv(csv('5/27/2026,Dinner,Whey,2.5,3,24,130,0'))
    expect(valid[0].fat).toBe(2.5)
  })

  it('parses a quoted field containing a comma', () => {
    const { valid, errors } = parseCsv(csv('5/27/2026,Lunch,"Yogurt, plain",0,7,16,90,0'))
    expect(errors).toEqual([])
    expect(valid[0].description).toBe('Yogurt, plain')
  })

  it('skips blank lines without erroring', () => {
    const { valid, errors } = parseCsv(csv('5/27/2026,Lunch,Egg,5,1,6,70,0', '', '   '))
    expect(valid).toHaveLength(1)
    expect(errors).toEqual([])
  })

  it('flags an invalid date with the source line number', () => {
    const { valid, errors } = parseCsv(csv('2/30/2026,Lunch,Egg,5,1,6,70,0'))
    expect(valid).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(2) // header is line 1
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('flags a malformed date string', () => {
    const { errors } = parseCsv(csv('2026-05-27,Lunch,Egg,5,1,6,70,0'))
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('flags an unrecognised meal type', () => {
    const { errors } = parseCsv(csv('5/27/2026,Brunch,Egg,5,1,6,70,0'))
    expect(errors[0].reason).toMatch(/meal type/i)
  })

  it('flags a non-numeric macro', () => {
    const { errors } = parseCsv(csv('5/27/2026,Lunch,Egg,abc,1,6,70,0'))
    expect(errors[0].reason).toMatch(/fat/i)
  })

  it('flags a negative macro', () => {
    const { errors } = parseCsv(csv('5/27/2026,Lunch,Egg,5,-1,6,70,0'))
    expect(errors[0].reason).toMatch(/carbs/i)
  })

  it('flags a missing required field (too few columns)', () => {
    const { errors } = parseCsv(csv('5/27/2026,Lunch,Egg,5,1,6'))
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(2)
  })

  it('flags a blank food description', () => {
    const { errors } = parseCsv(csv('5/27/2026,Lunch,,5,1,6,70,0'))
    expect(errors[0].reason).toMatch(/description/i)
  })

  it('keeps valid rows and reports errors for bad ones together', () => {
    const { valid, errors } = parseCsv(
      csv(
        '5/27/2026,Breakfast,Egg,5,1,6,70,0',
        '5/27/2026,Brunch,Mystery,1,1,1,1,1',
        '5/27/2026,Dinner,Steak,24,0,21,480,0',
      ),
    )
    expect(valid).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(3)
  })

  it('errors on a missing or wrong header', () => {
    const { valid, errors } = parseCsv('Foo,Bar\n5/27/2026,Lunch,Egg,5,1,6,70,0')
    expect(valid).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/header/i)
  })

  it('returns empty for a header-only file', () => {
    expect(parseCsv(HEADER)).toEqual({ valid: [], errors: [] })
  })

  it('parses the bundled sample file with no errors', () => {
    // Vitest runs with the project root as cwd.
    const text = readFileSync('src/data/meal-bulk-load.csv', 'utf8')
    const { valid, errors } = parseCsv(text)
    expect(errors).toEqual([])
    expect(valid).toHaveLength(13)
    // "Snack" in the sample normalises to "Snacks".
    expect(valid.some((e) => e.mealType === 'Snacks')).toBe(true)
  })
})
