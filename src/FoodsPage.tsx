import { useState, type FormEvent } from 'react'
import { type UserFoodReference } from './lib/foods'
import { type NewFoodInput } from './AddFoodModal'

type FoodsPageProps = {
  // The user-managed reference foods, keyed by category.
  foods: Record<string, UserFoodReference[]>
  // Raised when a food's log action is used, with the macros mapped for AddFoodModal.
  onSelectFood: (values: Partial<NewFoodInput>) => void
  addFood: (category: string, food: Omit<UserFoodReference, 'id'>) => void
  updateFood: (category: string, food: UserFoodReference) => void
  deleteFood: (category: string, id: string) => void
  addCategory: (name: string) => void
  deleteCategory: (name: string) => void
}

// Map a user food onto the modal's input shape. Macros are already numbers; the
// serving size is passed so the modal opens in quantity-scaling mode. fat/fiber
// flow through only when the food carries them.
function toFoodInput(food: UserFoodReference): Partial<NewFoodInput> {
  return {
    description: food.food,
    servingSize: food.serving_size,
    protein: food.protein,
    carbs: food.carbs,
    calories: food.calories,
    ...(food.fat !== undefined ? { fat: food.fat } : {}),
    ...(food.fiber !== undefined ? { fiber: food.fiber } : {}),
  }
}

// The food form's fields are held as strings; protein/carbs/calories are
// required, fat/fiber optional (blank → omitted).
type FoodForm = {
  food: string
  serving_size: string
  protein: string
  carbs: string
  calories: string
  fat: string
  fiber: string
}

const blankForm: FoodForm = {
  food: '',
  serving_size: '',
  protein: '',
  carbs: '',
  calories: '',
  fat: '',
  fiber: '',
}

function formFrom(food: UserFoodReference): FoodForm {
  return {
    food: food.food,
    serving_size: food.serving_size,
    protein: String(food.protein),
    carbs: String(food.carbs),
    calories: String(food.calories),
    fat: food.fat !== undefined ? String(food.fat) : '',
    fiber: food.fiber !== undefined ? String(food.fiber) : '',
  }
}

// Parse a required macro: blank or non-negative-number-failing returns an error.
function parseRequired(label: string, raw: string): { value: number } | { error: string } {
  const value = Number(raw.trim())
  if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
    return { error: `${label} must be a non-negative number.` }
  }
  return { value }
}

// Parse an optional macro: blank → omitted; otherwise must be non-negative.
function parseOptional(label: string, raw: string): { value?: number } | { error: string } {
  if (raw.trim() === '') return {}
  const value = Number(raw.trim())
  if (!Number.isFinite(value) || value < 0) return { error: `${label} must be a non-negative number.` }
  return { value }
}

/**
 * Browse and manage the user's reference foods, grouped by category. Each row's
 * log action hands its mapped macros up via onSelectFood; rows can also be edited
 * or deleted, categories added or removed, and new foods added via the side form.
 * Owns only its draft form state — the foods record is the caller's source of truth.
 */
function FoodsPage({
  foods,
  onSelectFood,
  addFood,
  updateFood,
  deleteFood,
  addCategory,
  deleteCategory,
}: FoodsPageProps) {
  const categories = Object.keys(foods)
  const [form, setForm] = useState<FoodForm>(blankForm)
  // The category the form targets; defaults to the first existing category.
  const [targetCategory, setTargetCategory] = useState('')
  // When set, the form is editing this existing food (category locked).
  const [editing, setEditing] = useState<{ category: string; id: string } | null>(null)
  const [foodError, setFoodError] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null)

  // The category in effect for the form: the locked one when editing, else the
  // chosen target, falling back to the first category.
  const effectiveCategory = editing?.category ?? (targetCategory || categories[0] || '')

  const setField = (key: keyof FoodForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const resetForm = () => {
    setForm(blankForm)
    setEditing(null)
    setFoodError(null)
  }

  const startEdit = (category: string, food: UserFoodReference) => {
    setEditing({ category, id: food.id })
    setForm(formFrom(food))
    setFoodError(null)
  }

  const handleFoodSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const name = form.food.trim()
    if (!name) return setFoodError('Please enter a food name.')
    const serving = form.serving_size.trim()
    if (!serving) return setFoodError('Please enter a serving size.')
    if (!effectiveCategory) return setFoodError('Please add a category first.')

    const protein = parseRequired('Protein', form.protein)
    if ('error' in protein) return setFoodError(protein.error)
    const carbs = parseRequired('Carbs', form.carbs)
    if ('error' in carbs) return setFoodError(carbs.error)
    const calories = parseRequired('Calories', form.calories)
    if ('error' in calories) return setFoodError(calories.error)
    const fat = parseOptional('Fat', form.fat)
    if ('error' in fat) return setFoodError(fat.error)
    const fiber = parseOptional('Fiber', form.fiber)
    if ('error' in fiber) return setFoodError(fiber.error)

    const base = {
      food: name,
      serving_size: serving,
      protein: protein.value,
      carbs: carbs.value,
      calories: calories.value,
      ...(fat.value !== undefined ? { fat: fat.value } : {}),
      ...(fiber.value !== undefined ? { fiber: fiber.value } : {}),
    }

    if (editing) {
      updateFood(editing.category, { id: editing.id, ...base })
    } else {
      addFood(effectiveCategory, base)
    }
    resetForm()
  }

  const handleCategorySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) return setCategoryError('Please enter a category name.')
    if (name in foods) return setCategoryError('That category already exists.')
    addCategory(name)
    setNewCategory('')
    setCategoryError(null)
  }

  // Confirm before dropping a category that still holds foods.
  const removeCategory = (name: string) => {
    const count = foods[name]?.length ?? 0
    if (count > 0 && !window.confirm(`Delete category "${name}" and its ${count} food(s)?`)) return
    if (editing?.category === name) resetForm()
    // Drop a stale add-target pointing at the gone category, so the next "Add
    // food" doesn't resurrect it via addFood's create-if-missing behaviour.
    if (targetCategory === name) setTargetCategory('')
    deleteCategory(name)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Foods</h1>
        <p className="text-sm text-slate-500">
          Tap a food to start a log entry pre-filled with its macros, or manage your library below.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-8">
          {categories.length === 0 && (
            <p className="text-sm italic text-slate-400">
              No categories yet. Add one to start building your food library.
            </p>
          )}
          {categories.map((category) => (
            <section key={category} aria-label={category}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{category}</h2>
                <button
                  type="button"
                  aria-label={`Delete category ${category}`}
                  onClick={() => removeCategory(category)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600 focus:outline-none"
                >
                  Delete category
                </button>
              </div>
              {foods[category].length === 0 ? (
                <p className="text-sm italic text-slate-400">No foods in this category yet.</p>
              ) : (
                <ul className="space-y-2">
                  {foods[category].map((food) => (
                    <li
                      key={food.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm"
                    >
                      <button
                        type="button"
                        aria-label={food.food}
                        onClick={() => onSelectFood(toFoodInput(food))}
                        className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{food.food}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {food.serving_size}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{food.protein}g</span> protein
                          <span className="block">
                            {food.carbs}g carbs · {food.calories} kcal
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${food.food}`}
                        onClick={() => startEdit(category, food)}
                        className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${food.food}`}
                        onClick={() => deleteFood(category, food.id)}
                        className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <aside className="space-y-6 lg:w-72">
          {/* Add / edit food */}
          <section
            aria-label={editing ? 'Edit food' : 'Add food'}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit food' : 'Add food'}
            </h2>
            <form onSubmit={handleFoodSubmit} className="space-y-3" noValidate>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Category</span>
                {editing ? (
                  <span
                    aria-label="Food category"
                    className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
                  >
                    {editing.category}
                  </span>
                ) : (
                  <select
                    aria-label="Food category"
                    value={effectiveCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Food name</span>
                <input
                  type="text"
                  aria-label="New food name"
                  value={form.food}
                  onChange={(e) => setField('food', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Serving size</span>
                <input
                  type="text"
                  aria-label="New food serving size"
                  value={form.serving_size}
                  onChange={(e) => setField('serving_size', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                />
              </label>

              {(
                [
                  ['protein', 'Protein', 'New food protein', true],
                  ['carbs', 'Carbs', 'New food carbs', true],
                  ['calories', 'Calories', 'New food calories', true],
                  ['fat', 'Fat', 'New food fat', false],
                  ['fiber', 'Fiber', 'New food fiber', false],
                ] as const
              ).map(([key, label, aria, required]) => (
                <label key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">
                    {label}
                    {key !== 'calories' && <span className="text-slate-400"> (g)</span>}
                    {!required && <span className="text-slate-400"> · optional</span>}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={aria}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                </label>
              ))}

              {foodError && (
                <p role="alert" className="text-sm text-rose-600">
                  {foodError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
                >
                  {editing ? 'Save changes' : 'Add food'}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Add category */}
          <section
            aria-label="Add category"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add category</h2>
            <form onSubmit={handleCategorySubmit} className="space-y-3" noValidate>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Category name</span>
                <input
                  type="text"
                  aria-label="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
                />
              </label>
              {categoryError && (
                <p role="alert" className="text-sm text-rose-600">
                  {categoryError}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
              >
                Add category
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default FoodsPage
