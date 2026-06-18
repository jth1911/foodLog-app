// Isolated, framework-free Google Gemini client for estimating a reference
// food's per-serving macros from its name + serving size. Kept out of the
// component (like nutrition.ts / foods.ts) so the prompt-building, response
// parsing and merge rules can be unit-tested without React or the network.
//
// SECURITY: this is a pure client-side Vite app with no backend, so the key
// (VITE_GEMINI_API_KEY) is inlined into the shipped bundle. That is only
// acceptable for a personal/local build — see README. A server-side proxy is
// the secure alternative if this is ever deployed for others.

import { GoogleGenAI, Type } from '@google/genai'
import { MACRO_KEYS, type MacroKey } from './nutrition'

// A partial per-serving macro set: only the fields the model returned with a
// usable (finite, non-negative) value.
export type EstimatedMacros = Partial<Record<MacroKey, number>>

// Vite only inlines build-time vars prefixed with VITE_; it does not read
// process.env at runtime in the browser. Read it lazily (not at module load)
// so tests can stub the env per case.
function apiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY ?? ''
}

/** Whether an API key is present, so the UI can hide/disable the control. */
export function isGeminiConfigured(): boolean {
  return apiKey().trim() !== ''
}

// A current flash-tier model. Structured JSON output only — Google Search
// grounding is intentionally not combined here, as the googleSearch tool and a
// strict responseSchema can't be used together (see README follow-up note).
const MODEL = 'gemini-3.5-flash'

// Ask for every macro as an optional number; we keep only what comes back
// usable and the form merges only the blanks. Numbers are per serving.
const responseSchema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(MACRO_KEYS.map((key) => [key, { type: Type.NUMBER }])),
}

// Coerce one raw value to a finite, non-negative number, or undefined. Only a
// number or a non-blank numeric string counts — null/undefined/'' are dropped
// (Number(null) and Number('') are 0, which would wrongly read as a real value).
function usableNumber(raw: unknown): number | undefined {
  let value: number
  if (typeof raw === 'number') value = raw
  else if (typeof raw === 'string' && raw.trim() !== '') value = Number(raw)
  else return undefined
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Estimate a food's per-serving macros with Gemini. Sends the name + serving
 * size, requests structured JSON, and returns only the fields that came back
 * usable. Throws on a missing key, a network/quota/SDK failure, an unparseable
 * response, or a response with no usable macros — callers surface these inline
 * and never let them block manual entry.
 */
export async function estimateMacros({
  food,
  serving_size,
}: {
  food: string
  serving_size: string
}): Promise<EstimatedMacros> {
  if (!isGeminiConfigured()) {
    throw new Error('No Gemini API key configured (set VITE_GEMINI_API_KEY).')
  }

  const ai = new GoogleGenAI({ apiKey: apiKey() })

  const prompt =
    `Estimate the nutrition for one serving of the food below. ` +
    `Return per-serving values for the macros you are confident about; omit any you are unsure of. ` +
    `Protein, carbs, fat and fiber are in grams; calories are in kcal.\n` +
    `Food: ${food}\nServing size: ${serving_size}`

  let response
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema },
    })
  } catch (cause) {
    throw new Error('Could not reach Gemini. Check your connection or quota and try again.', {
      cause,
    })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(response.text ?? '')
  } catch {
    throw new Error('Gemini returned an unexpected response. Please try again.')
  }

  const record = (parsed ?? {}) as Record<string, unknown>
  const macros: EstimatedMacros = {}
  for (const key of MACRO_KEYS) {
    const value = usableNumber(record[key])
    if (value !== undefined) macros[key] = value
  }

  if (Object.keys(macros).length === 0) {
    throw new Error('Gemini could not estimate any macros for this food. Please fill them in.')
  }

  return macros
}

// The macro fields as held in the food form (all strings; blank = empty).
type MacroFields = Record<MacroKey, string>

/**
 * Given the current form's macro fields and an estimate, return the subset of
 * fields to fill: only those currently blank (whitespace counts as blank) for
 * which the estimate offers a value. Values the user already typed are never
 * overwritten. Pure, so the merge rule is testable on its own.
 */
export function mergeEmptyMacros(
  fields: MacroFields,
  estimate: EstimatedMacros,
): Partial<MacroFields> {
  const filled: Partial<MacroFields> = {}
  for (const key of MACRO_KEYS) {
    const value = estimate[key]
    if (value !== undefined && fields[key].trim() === '') filled[key] = String(value)
  }
  return filled
}
