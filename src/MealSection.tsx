import type { FoodEntry, MealType } from './lib/nutrition'

type MealSectionProps = {
  meal: MealType
  entries: FoodEntry[]
  onDelete: (id: string) => void
}

/** One meal bucket: heading, then either an empty state or a row per entry. */
function MealSection({ meal, entries, onDelete }: MealSectionProps) {
  // Ask before removing so an accidental tap doesn't drop an entry.
  const confirmDelete = (entry: FoodEntry) => {
    if (window.confirm(`Delete "${entry.description}"?`)) onDelete(entry.id)
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{meal}</h3>
      {entries.length === 0 ? (
        <p className="text-sm italic text-slate-400">No food logged for {meal.toLowerCase()} yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-slate-700">{item.description}</span>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                <span>{item.calories} kcal</span>
                <span>P {item.protein}</span>
                <span>F {item.fat}</span>
                <span>C {item.carbs}</span>
                <span>Fb {item.fiber}</span>
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
        </ul>
      )}
    </div>
  )
}

export default MealSection
