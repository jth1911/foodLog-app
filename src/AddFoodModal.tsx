import { useEffect, useState, type FormEvent } from 'react'
import { MACRO_KEYS, MACRO_META, MEAL_TYPES, type MacroKey, type MealType } from './lib/nutrition'
import { scaleMacros } from './lib/foods'

// The fields the user actually enters. The dashboard stamps id/date/week/weekday.
export type NewFoodInput = {
  description: string
  mealType: MealType
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  // Set only when logging a pre-filled food with a quantity. The macros above
  // are the scaled totals; these flow onto the FoodEntry for the log-row label.
  servingSize?: string
  quantity?: number
}

// Macros handed up from the Foods page to pre-fill the modal, plus the day the
// Foods panel targeted. targetDate rides alongside the food fields so the
// dashboard can jump to that day before stamping the entry; it is stripped back
// out before the values reach the modal (which only knows NewFoodInput fields).
export type FoodPrefill = Partial<NewFoodInput> & { targetDate?: string }

type AddFoodModalProps = {
  onAdd: (input: NewFoodInput) => void
  onClose: () => void
  // Optional seed so the modal can open pre-filled (e.g. from the Foods page).
  // Omitted fields stay blank, matching a fresh open from the FAB.
  initialValues?: Partial<NewFoodInput>
  // Edit an existing entry rather than add a new one: the macro fields are the
  // final totals (no quantity scaling, even if a servingSize is present), and
  // the title/submit label read "Edit food"/"Save".
  editing?: boolean
}

// Start every numeric field blank so the form doesn't pre-fill zeros.
const emptyMacros: Record<(typeof MACRO_KEYS)[number], string> = {
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: '',
}

// Turn any provided numeric macros into the string fields the form holds.
// A field absent from initialValues stays blank rather than showing a 0.
function macrosFrom(initial: Partial<NewFoodInput> | undefined) {
  const macros = { ...emptyMacros }
  if (!initial) return macros
  for (const key of MACRO_KEYS) {
    const value = initial[key]
    if (value !== undefined) macros[key] = String(value)
  }
  return macros
}

/**
 * Presentational add-food form shown in a Tailwind overlay. Collects the
 * user-entered fields, validates them, and reports a NewFoodInput up via onAdd.
 * Owns no app state — the dashboard remains the single source of truth.
 */
function AddFoodModal({ onAdd, onClose, initialValues, editing = false }: AddFoodModalProps) {
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [mealType, setMealType] = useState<MealType>(initialValues?.mealType ?? MEAL_TYPES[0])
  const [macros, setMacros] = useState(() => macrosFrom(initialValues))
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)

  // Opened from the Foods page (a reference serving exists): the macro fields
  // represent one serving and a quantity multiplies them. A blank FAB open has
  // no servingSize, so the quantity UI stays hidden and macros are final.
  // Editing an existing entry always treats macros as final totals, even if the
  // entry carried a servingSize — the user edits the totals directly.
  const servingSize = editing ? undefined : initialValues?.servingSize
  const isPrefilled = servingSize != null

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

    if (isPrefilled) {
      const qty = Number(quantity.trim())
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Quantity must be a number greater than 0.')
        return
      }
      onAdd({
        description: name,
        mealType,
        ...scaleMacros(parsed, qty),
        servingSize,
        quantity: qty,
      })
      onClose()
      return
    }

    onAdd({ description: name, mealType, ...parsed })
    onClose()
  }

  // Per-serving macros parsed leniently (blank/invalid → 0) for the live preview,
  // then scaled by the current quantity. Only shown in pre-filled mode.
  const previewQuantity = Number(quantity.trim())
  const previewMacros = (() => {
    const perServing = {} as Record<MacroKey, number>
    for (const key of MACRO_KEYS) {
      const value = Number(macros[key].trim())
      perServing[key] = Number.isFinite(value) && value >= 0 ? value : 0
    }
    const qty = Number.isFinite(previewQuantity) && previewQuantity > 0 ? previewQuantity : 0
    return scaleMacros(perServing, qty)
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit food' : 'Add food'}
        // Stop backdrop clicks from closing when interacting inside the card.
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit food' : 'Add food'}</h2>
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

          {isPrefilled && (
            <div className="rounded-md bg-slate-50 p-3">
              <div className="flex items-end gap-3">
                <div className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Serving</span>
                  <span
                    aria-label="Serving size"
                    className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-500"
                  >
                    {servingSize}
                  </span>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500" aria-label="Scaled totals">
                Logs:{' '}
                {MACRO_KEYS.map((key) => `${previewMacros[key]} ${MACRO_META[key].unit}`).join(' · ')}
              </p>
            </div>
          )}

          {isPrefilled && (
            <p className="-mb-2 text-xs text-slate-400">Macros are per serving.</p>
          )}

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
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFoodModal
