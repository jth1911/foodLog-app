import type { FoodEntry, MealType } from './lib/nutrition'

type MealSectionProps = {
  meal: MealType
  entries: FoodEntry[]
}

/** One meal bucket: heading, then either an empty state or a row per entry. */
function MealSection({ meal, entries }: MealSectionProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{meal}</h3>
      {entries.length === 0 ? (
        <p className="text-sm italic text-slate-400">No food logged for {meal.toLowerCase()} yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">{item.description}</span>
              <span className="flex gap-3 text-xs text-slate-500">
                <span>{item.calories} kcal</span>
                <span>P {item.protein}</span>
                <span>F {item.fat}</span>
                <span>C {item.carbs}</span>
                <span>Fb {item.fiber}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MealSection
