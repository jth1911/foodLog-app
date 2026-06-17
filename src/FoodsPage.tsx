import { foodCategories, normaliseMacro, type FoodReference } from './lib/foods'
import { type NewFoodInput } from './AddFoodModal'

type FoodsPageProps = {
  // Raised when a food row is clicked, with the macros mapped for AddFoodModal.
  // fat/fiber are absent from the reference data, so the user fills those in.
  onSelectFood: (values: Partial<NewFoodInput>) => void
}

// Map a reference food onto the modal's input shape. Only the fields the JSON
// carries are set; fat and fiber are intentionally left for the user.
function toFoodInput(food: FoodReference): Partial<NewFoodInput> {
  return {
    description: food.food,
    protein: normaliseMacro(food.protein_g),
    carbs: normaliseMacro(food.carbs_g),
    calories: normaliseMacro(food.calories_kcal),
  }
}

/**
 * Browse reference foods grouped by category. Clicking a row hands its mapped
 * macros up via onSelectFood so the caller can open AddFoodModal pre-filled.
 * Owns no state — new categories appear automatically as the JSON grows.
 */
function FoodsPage({ onSelectFood }: FoodsPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Foods</h1>
        <p className="text-sm text-slate-500">
          Tap a food to start a log entry pre-filled with its macros.
        </p>
      </header>

      <div className="space-y-8">
        {Object.entries(foodCategories).map(([category, foods]) => (
          <section key={category} aria-label={category}>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{category}</h2>
            <ul className="space-y-2">
              {foods.map((food, index) => (
                <li key={`${food.food}-${index}`}>
                  <button
                    type="button"
                    aria-label={food.food}
                    onClick={() => onSelectFood(toFoodInput(food))}
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {food.food}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {food.serving_size}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {normaliseMacro(food.protein_g)}g
                      </span>{' '}
                      protein
                      <span className="block">
                        {normaliseMacro(food.carbs_g)}g carbs · {normaliseMacro(food.calories_kcal)}{' '}
                        kcal
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export default FoodsPage
