import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A controllable fake for the SDK's generateContent. Each test sets its
// behaviour, then we assert on how gemini.ts called it and parsed its result.
// Hoisted so the vi.mock factory (itself hoisted) can close over them.
const { generateContent, GoogleGenAI } = vi.hoisted(() => {
  const generateContent = vi.fn()
  return {
    generateContent,
    GoogleGenAI: vi.fn(function () {
      return { models: { generateContent } }
    }),
  }
})
vi.mock('@google/genai', () => ({
  GoogleGenAI,
  Type: { OBJECT: 'OBJECT', NUMBER: 'NUMBER', STRING: 'STRING' },
}))

import {
  estimateMacros,
  isGeminiConfigured,
  mergeEmptyMacros,
} from './gemini'

// Helper: an SDK response carries the model output on `.text`.
const reply = (text: string) => ({ text })

describe('isGeminiConfigured', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is true when VITE_GEMINI_API_KEY is a non-empty string', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    expect(isGeminiConfigured()).toBe(true)
  })

  it('is false when the key is absent or blank', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '')
    expect(isGeminiConfigured()).toBe(false)
  })
})

describe('estimateMacros', () => {
  beforeEach(() => {
    generateContent.mockReset()
    GoogleGenAI.mockClear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('passes the food name and serving size to the model', async () => {
    generateContent.mockResolvedValue(reply('{"protein":6,"carbs":1,"calories":70}'))
    await estimateMacros({ food: 'Egg', serving_size: '1 large' })

    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' })
    const arg = generateContent.mock.calls[0][0]
    const contents = JSON.stringify(arg.contents)
    expect(contents).toContain('Egg')
    expect(contents).toContain('1 large')
    // Structured JSON output, per the issue.
    expect(arg.config.responseMimeType).toBe('application/json')
    expect(arg.config.responseSchema).toBeTruthy()
  })

  it('returns the parsed macro numbers', async () => {
    generateContent.mockResolvedValue(
      reply('{"protein":6,"carbs":1.5,"calories":70,"fat":5,"fiber":0}'),
    )
    const out = await estimateMacros({ food: 'Egg', serving_size: '1 large' })
    expect(out).toEqual({ protein: 6, carbs: 1.5, calories: 70, fat: 5, fiber: 0 })
  })

  it('drops fields that are missing, negative or non-finite', async () => {
    generateContent.mockResolvedValue(
      reply('{"protein":6,"carbs":-2,"calories":"oops","fat":null}'),
    )
    const out = await estimateMacros({ food: 'Egg', serving_size: '1 large' })
    expect(out).toEqual({ protein: 6 })
  })

  it('throws when no API key is configured', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '')
    await expect(estimateMacros({ food: 'Egg', serving_size: '1 large' })).rejects.toThrow()
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('throws on a network/SDK failure', async () => {
    generateContent.mockRejectedValue(new Error('quota exceeded'))
    await expect(estimateMacros({ food: 'Egg', serving_size: '1 large' })).rejects.toThrow()
  })

  it('throws on an unparseable response', async () => {
    generateContent.mockResolvedValue(reply('not json'))
    await expect(estimateMacros({ food: 'Egg', serving_size: '1 large' })).rejects.toThrow()
  })

  it('throws when the response yields no usable macros', async () => {
    generateContent.mockResolvedValue(reply('{"protein":-1}'))
    await expect(estimateMacros({ food: 'Egg', serving_size: '1 large' })).rejects.toThrow()
  })
})

describe('mergeEmptyMacros', () => {
  const blank = { protein: '', carbs: '', calories: '', fat: '', fiber: '' }

  it('fills only the fields that are currently blank', () => {
    const merged = mergeEmptyMacros(
      { ...blank, protein: '8' },
      { protein: 6, carbs: 1, calories: 70 },
    )
    expect(merged).toEqual({ carbs: '1', calories: '70' })
  })

  it('never overwrites a value the user already entered', () => {
    const merged = mergeEmptyMacros(
      { ...blank, protein: '8', carbs: '2' },
      { protein: 6, carbs: 1 },
    )
    expect(merged).toEqual({})
  })

  it('ignores estimate fields not offered by the model', () => {
    const merged = mergeEmptyMacros(blank, { protein: 6 })
    expect(merged).toEqual({ protein: '6' })
  })

  it('treats whitespace-only fields as blank', () => {
    const merged = mergeEmptyMacros({ ...blank, fat: '   ' }, { fat: 5 })
    expect(merged).toEqual({ fat: '5' })
  })
})
