import { useEffect, useState, type FormEvent } from 'react'
import { DRINK_TYPES, type DrinkType } from './lib/fluid'

// The fields the user enters for a drink. The dashboard stamps id/date/week/
// weekday, mirroring NewFoodInput.
export type NewFluidInput = {
  drinkType: DrinkType
  oz: number
  calories: number
}

type AddFluidModalProps = {
  onAdd: (input: NewFluidInput) => void
  onClose: () => void
  // Optional seed so the modal can open pre-filled (e.g. when editing a drink).
  initialValues?: Partial<NewFluidInput>
  // Edit an existing drink rather than add a new one: the title/submit label read
  // "Edit drink"/"Save".
  editing?: boolean
}

/**
 * Presentational add-drink form shown in a Tailwind overlay, mirroring
 * AddFoodModal. Collects a drink type, a volume in fluid ounces (required, > 0)
 * and optional calories (blank → 0), validates them, and reports a NewFluidInput
 * up via onAdd. Owns no app state — the dashboard stays the source of truth.
 */
function AddFluidModal({ onAdd, onClose, initialValues, editing = false }: AddFluidModalProps) {
  const [drinkType, setDrinkType] = useState<DrinkType>(initialValues?.drinkType ?? DRINK_TYPES[0])
  const [oz, setOz] = useState(initialValues?.oz != null ? String(initialValues.oz) : '')
  const [calories, setCalories] = useState(
    initialValues?.calories != null ? String(initialValues.calories) : '',
  )
  const [error, setError] = useState<string | null>(null)

  // Esc closes the modal, matching native dialog behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // The volume is required and must be greater than zero.
    const ozValue = Number(oz.trim())
    if (oz.trim() === '' || !Number.isFinite(ozValue) || ozValue <= 0) {
      setError('Amount must be a number greater than 0.')
      return
    }

    // Calories are optional — blank counts as 0; negatives are rejected.
    const rawCalories = calories.trim()
    const caloriesValue = rawCalories === '' ? 0 : Number(rawCalories)
    if (!Number.isFinite(caloriesValue) || caloriesValue < 0) {
      setError('Calories must be a non-negative number.')
      return
    }

    onAdd({ drinkType, oz: ozValue, calories: caloriesValue })
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
        aria-label={editing ? 'Edit drink' : 'Add drink'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {editing ? 'Edit drink' : 'Add drink'}
          </h2>
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
            <span className="mb-1 block font-medium text-slate-600">Drink type</span>
            <select
              aria-label="Drink type"
              value={drinkType}
              onChange={(e) => setDrinkType(e.target.value as DrinkType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
            >
              {DRINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Amount <span className="text-slate-400">(fl oz)</span>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                aria-label="Amount (fl oz)"
                value={oz}
                onChange={(e) => setOz(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">Calories</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                aria-label="Calories"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </label>
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
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFluidModal
