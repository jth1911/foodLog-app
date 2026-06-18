import { MACRO_KEYS, type FoodEntry, type MealType } from './lib/nutrition'

type MealSectionProps = {
  meal: MealType
  entries: FoodEntry[]
  onDelete: (id: string) => void
  onEdit: (entry: FoodEntry) => void
}

// Each meal gets a distinct, bold header colour so the feed is easy to scan.
const MEAL_HEADER_COLOR: Record<MealType, string> = {
  Breakfast: 'text-blue-600',
  Lunch: 'text-green-600',
  Dinner: 'text-purple-600',
  Snacks: 'text-amber-600',
}

/** One meal bucket: heading, then either an empty state or a row per entry. */
function MealSection({ meal, entries, onDelete, onEdit }: MealSectionProps) {
  // Ask before removing so an accidental tap doesn't drop an entry.
  const confirmDelete = (entry: FoodEntry) => {
    if (window.confirm(`Delete "${entry.description}"?`)) onDelete(entry.id)
  }

  // Per-meal macro subtotal — a plain reduce over this section's entries.
  const subtotal = entries.reduce(
    (sum, item) => {
      for (const key of MACRO_KEYS) sum[key] += item[key]
      return sum
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  )

  return (
    <div>
      <h3 className={`mb-2 text-sm font-bold uppercase tracking-wide ${MEAL_HEADER_COLOR[meal]}`}>
        {meal}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm italic text-slate-400">No food logged for {meal.toLowerCase()} yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-slate-700">
                {item.description}
                {/* Reference foods logged with a quantity show "2 × 1 large". */}
                {item.quantity != null && item.servingSize != null && (
                  <span className="ml-2 text-xs text-slate-400">
                    {item.quantity} × {item.servingSize}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                <span>{item.calories} kcal</span>
                <span>P {item.protein}</span>
                <span>F {item.fat}</span>
                <span>C {item.carbs}</span>
                <span>Fb {item.fiber}</span>
                <button
                  type="button"
                  aria-label={`Edit ${item.description}`}
                  onClick={() => onEdit(item)}
                  className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.description}`}
                  onClick={() => confirmDelete(item)}
                  className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
          {/* Per-meal subtotal. Invisible button-sized spacers keep its macro
              columns aligned with the entry rows above. */}
          <li
            data-testid="meal-subtotal"
            className="flex items-center justify-between gap-3 py-2 text-sm font-semibold text-slate-600"
          >
            <span className="min-w-0">Total</span>
            <span className="flex items-center gap-3 text-xs">
              <span>{subtotal.calories} kcal</span>
              <span>P {subtotal.protein}</span>
              <span>F {subtotal.fat}</span>
              <span>C {subtotal.carbs}</span>
              <span>Fb {subtotal.fiber}</span>
              <span className="invisible px-1" aria-hidden="true">
                ✎
              </span>
              <span className="invisible px-1" aria-hidden="true">
                ✕
              </span>
            </span>
          </li>
        </ul>
      )}
    </div>
  )
}

export default MealSection
