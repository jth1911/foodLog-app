import { fluidGoalStatus, fluidTotalsForDate, type FluidEntry } from './lib/fluid'

type FluidSectionProps = {
  // The drinks for the selected day (already filtered to that date).
  fluids: FluidEntry[]
  // The day's date, so the running total is computed for it.
  date: string
  // The daily fluid target in oz, or null when none is set.
  targetFluid: number | null
  onEdit: (fluid: FluidEntry) => void
  onDelete: (id: string) => void
}

// Once a target is set, under it reads red and at/over it reads green. Without a
// target there's nothing to judge against, so the total stays neutral.
const statusClasses: Record<'met' | 'unmet' | 'none', string> = {
  met: 'text-emerald-600',
  unmet: 'text-rose-600',
  none: 'text-slate-900',
}

/**
 * The day's fluid log: a row per drink with edit/delete, a running oz total, and
 * progress toward the daily target. Mirrors MealFeed/MealSection and the
 * WeightCard goal display. Caloric drinks also feed the dashboard's calorie
 * total (handled by the parent); here we surface volume and the per-drink
 * calories.
 */
function FluidSection({ fluids, date, targetFluid, onEdit, onDelete }: FluidSectionProps) {
  const totals = fluidTotalsForDate(fluids, date)
  // Progress colour follows the goal only when a target is actually set.
  const status = targetFluid != null ? fluidGoalStatus(totals.oz, targetFluid) : 'none'

  // Ask before removing so an accidental tap doesn't drop a drink.
  const confirmDelete = (fluid: FluidEntry) => {
    if (window.confirm(`Delete this ${fluid.drinkType.toLowerCase()} (${fluid.oz} fl oz)?`)) {
      onDelete(fluid.id)
    }
  }

  return (
    <section aria-label="Fluids" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Fluids</h2>
        <p className="text-sm">
          <span aria-label="Fluid total" className={`text-lg font-semibold ${statusClasses[status]}`}>
            {totals.oz}
          </span>
          <span className="text-slate-400">
            {targetFluid != null ? ` / ${targetFluid}` : ''} fl oz
          </span>
        </p>
      </div>

      {fluids.length === 0 ? (
        <p className="text-sm italic text-slate-400">No drinks logged for this day yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {fluids.map((drink) => (
            <li key={drink.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-slate-700">{drink.drinkType}</span>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                <span>{drink.oz} fl oz</span>
                <span>{drink.calories} kcal</span>
                <button
                  type="button"
                  aria-label={`Edit ${drink.drinkType} ${drink.oz} fl oz`}
                  onClick={() => onEdit(drink)}
                  className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${drink.drinkType} ${drink.oz} fl oz`}
                  onClick={() => confirmDelete(drink)}
                  className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default FluidSection
