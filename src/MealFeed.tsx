import { useMemo } from 'react'
import { MEAL_TYPES, groupByMeal, type FoodEntry } from './lib/nutrition'
import MealSection from './MealSection'

type MealFeedProps = {
  loggedFoods: FoodEntry[]
  onDelete: (id: string) => void
  onEdit: (entry: FoodEntry) => void
}

/** The food log: all logged entries grouped into one section per meal. */
function MealFeed({ loggedFoods, onDelete, onEdit }: MealFeedProps) {
  const grouped = useMemo(() => groupByMeal(loggedFoods), [loggedFoods])

  return (
    <section
      aria-label="Food log"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Food log</h2>
      <div className="space-y-5">
        {MEAL_TYPES.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={grouped[meal]}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  )
}

export default MealFeed
