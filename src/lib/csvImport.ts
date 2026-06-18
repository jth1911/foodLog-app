// Pure, framework-free CSV parser/validator for bulk-importing food entries.
// Kept out of React — like nutrition.ts / foods.ts / logger.ts — so it can be
// unit-tested in isolation. The BulkImportModal feeds it the file text and turns
// the valid rows into FoodEntry records; the id/week/weekday are stamped at the
// call site (this module never touches crypto or the clock, so it stays pure).

import { MEAL_TYPES, type FoodEntry, type MealType } from './nutrition'

// One validated row, ready to be stamped with id/week/weekday into a FoodEntry.
export type ParsedEntry = Omit<FoodEntry, 'id' | 'week' | 'weekday'>

// A row that failed validation: the 1-based source line number (the header is
// line 1) and a human-readable reason.
export type ImportError = { row: number; reason: string }

export type ImportResult = { valid: ParsedEntry[]; errors: ImportError[] }

// The expected header columns, in order. Matched case-insensitively.
const COLUMNS = ['Date', 'Meal Type', 'Food Description', 'Fat', 'Carbs', 'Protein', 'Calories', 'Fiber']

// The macro columns, paired with the FoodEntry key they map to, in CSV order.
const MACRO_COLUMNS: { label: string; key: keyof ParsedEntry }[] = [
  { label: 'Fat', key: 'fat' },
  { label: 'Carbs', key: 'carbs' },
  { label: 'Protein', key: 'protein' },
  { label: 'Calories', key: 'calories' },
  { label: 'Fiber', key: 'fiber' },
]

/**
 * Split one CSV line into fields, honouring double-quoted fields (which may
 * contain commas) and "" as an escaped quote. Good enough for the simple
 * spreadsheet exports this importer targets — not a full RFC-4180 parser
 * (no embedded newlines inside quotes).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++ // skip the escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields.map((f) => f.trim())
}

/** Normalise a raw meal-type cell to a known MealType, or null if unrecognised. */
export function normaliseMealType(raw: string): MealType | null {
  const lower = raw.trim().toLowerCase()
  // Accept the singular "snack" as well as the canonical "snacks".
  const canonical = lower === 'snack' ? 'snacks' : lower
  return MEAL_TYPES.find((m) => m.toLowerCase() === canonical) ?? null
}

// Convert an "M/D/YYYY" cell to an ISO "YYYY-MM-DD" string, or null if it isn't
// a real calendar date. Validates ranges by round-tripping through Date.UTC so
// e.g. 2/30/2026 is rejected rather than rolling over into March.
function toIsoDate(raw: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// Coerce a macro cell to a finite, non-negative number, or null.
function toMacro(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 ? value : null
}

// Validate the header row against the expected columns (case-insensitive).
function headerMatches(fields: string[]): boolean {
  if (fields.length !== COLUMNS.length) return false
  return COLUMNS.every((col, i) => fields[i].toLowerCase() === col.toLowerCase())
}

/**
 * Parse and validate CSV text into valid entries plus per-row errors. The first
 * non-empty line must be the documented header. Blank lines are skipped (but
 * still counted, so error row numbers line up with the source file). Never
 * throws — malformed input becomes errors, not exceptions.
 */
export function parseCsv(text: string): ImportResult {
  const valid: ParsedEntry[] = []
  const errors: ImportError[] = []
  const lines = text.split(/\r?\n/)

  let headerSeen = false
  for (let i = 0; i < lines.length; i++) {
    const row = i + 1 // 1-based, matching what the user sees in their file
    const line = lines[i]
    if (line.trim() === '') continue // blank line: skip, keep the count

    const fields = splitCsvLine(line)

    if (!headerSeen) {
      headerSeen = true
      if (!headerMatches(fields)) {
        errors.push({
          row,
          reason: `Unexpected header — expected: ${COLUMNS.join(', ')}`,
        })
        // Without a valid header we can't trust column positions, so stop.
        return { valid: [], errors }
      }
      continue
    }

    if (fields.length !== COLUMNS.length) {
      errors.push({
        row,
        reason: `Expected ${COLUMNS.length} columns but found ${fields.length}`,
      })
      continue
    }

    const [rawDate, rawMeal, description] = fields

    const date = toIsoDate(rawDate)
    if (date === null) {
      errors.push({ row, reason: `Invalid date "${rawDate}" (expected M/D/YYYY)` })
      continue
    }

    const mealType = normaliseMealType(rawMeal)
    if (mealType === null) {
      errors.push({ row, reason: `Unrecognised meal type "${rawMeal}"` })
      continue
    }

    if (description.trim() === '') {
      errors.push({ row, reason: 'Missing food description' })
      continue
    }

    const macros: Partial<Record<keyof ParsedEntry, number>> = {}
    let macroError: string | null = null
    for (let m = 0; m < MACRO_COLUMNS.length; m++) {
      const { label, key } = MACRO_COLUMNS[m]
      const value = toMacro(fields[3 + m])
      if (value === null) {
        macroError = `${label} must be a non-negative number`
        break
      }
      macros[key] = value
    }
    if (macroError !== null) {
      errors.push({ row, reason: macroError })
      continue
    }

    valid.push({
      date,
      mealType,
      description: description.trim(),
      fat: macros.fat!,
      carbs: macros.carbs!,
      protein: macros.protein!,
      calories: macros.calories!,
      fiber: macros.fiber!,
    })
  }

  return { valid, errors }
}
