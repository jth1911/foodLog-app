import { useEffect, useState, type FormEvent } from 'react'
import { MACRO_KEYS, MACRO_META, MEAL_TYPES, type MealType } from './lib/nutrition'

// The fields the user actually enters. The dashboard stamps id/date/week/weekday.
export type NewFoodInput = {
  description: string
  mealType: MealType
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
}

type AddFoodModalProps = {
  onAdd: (input: NewFoodInput) => void
  onClose: () => void
}

// Start every numeric field blank so the form doesn't pre-fill zeros.
const emptyMacros: Record<(typeof MACRO_KEYS)[number], string> = {
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: '',
}

/**
 * Presentational add-food form shown in a Tailwind overlay. Collects the
 * user-entered fields, validates them, and reports a NewFoodInput up via onAdd.
 * Owns no app state — the dashboard remains the single source of truth.
 */
function AddFoodModal({ onAdd, onClose }: AddFoodModalProps) {
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<MealType>(MEAL_TYPES[0])
  const [macros, setMacros] = useState(emptyMacros)
  const [error, setError] = useState<string | null>(null)

  // Esc closes the modal, matching native dialog behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const setMacro = (key: keyof typeof macros, value: string) =>
    setMacros((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const name = description.trim()
    if (!name) {
      setError('Please enter a food name.')
      return
    }

    const parsed = {} as Record<(typeof MACRO_KEYS)[number], number>
    for (const key of MACRO_KEYS) {
      // Blank counts as 0; anything non-numeric or negative is rejected.
      const raw = macros[key].trim()
      const value = raw === '' ? 0 : Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        setError(`${MACRO_META[key].label} must be a non-negative number.`)
        return
      }
      parsed[key] = value
    }

    onAdd({ description: name, mealType, ...parsed })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add food"
        // Stop backdrop clicks from closing when interacting inside the card.
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add food</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Food name</span>
            <input
              type="text"
              aria-label="Food name"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Meal type</span>
            <select
              aria-label="Meal type"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
            >
              {MEAL_TYPES.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MACRO_KEYS.map((key) => {
              const meta = MACRO_META[key]
              return (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    {meta.label}
                    {meta.unit !== 'kcal' && (
                      <span className="text-slate-400"> ({meta.unit})</span>
                    )}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={meta.label}
                    value={macros[key]}
                    onChange={(e) => setMacro(key, e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                </label>
              )
            })}
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFoodModal
