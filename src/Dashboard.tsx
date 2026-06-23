import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DayPicker } from '@daypicker/react'
import { enGB } from 'date-fns/locale'
import '@daypicker/react/style.css'
import {
  MACRO_KEYS,
  MACRO_META,
  goalStatus,
  goalsForDate,
  totalsForDate,
  type FoodEntry,
  type GoalChange,
} from './lib/nutrition'
import MealFeed from './MealFeed'
import FluidSection from './FluidSection'
import AddFoodModal, { type FoodPrefill, type NewFoodInput } from './AddFoodModal'
import AddFluidModal, { type NewFluidInput } from './AddFluidModal'
import BulkImportModal from './BulkImportModal'
import { addDays, dateToIso, isoToDate, isoWeekOf, todayIso, weekdayOf } from './lib/dates'
import { weightForDate, previousWeight, type WeightEntry } from './lib/weight'
import { fluidTotalsForDate, type FluidEntry } from './lib/fluid'
import { useFoodLog } from './useFoodLog'

const statusClasses: Record<'met' | 'unmet', string> = {
  met: 'text-emerald-600',
  unmet: 'text-rose-600',
}

// Human-readable label for an ISO date, formatted in UTC to match addDays.
const dateLabelFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return dateLabelFormat.format(new Date(Date.UTC(year, month - 1, day)))
}

// Strip the Foods-page targetDate from a prefill, leaving only the fields the
// add-food modal understands. Returns undefined when there's nothing pending.
function foodFieldsOf(prefill: FoodPrefill | null | undefined): Partial<NewFoodInput> | undefined {
  if (!prefill) return undefined
  const fields = { ...prefill }
  delete fields.targetDate
  return fields
}

/**
 * The selected day's weight entry. A day with no weigh-in shows 0 — there's no
 * automatic carry-forward; the "Pull forward from previous day" button copies
 * the most recent earlier weight into the field (left to save). Saving records
 * that day's weight. The caller keys this on the selected date, so stepping
 * between days remounts it fresh with that day's value.
 */
function WeightCard({
  weight,
  previous,
  onSave,
}: {
  // The recorded weight for the day, or 0 when there's none yet.
  weight: number
  // The previous day's weight to pull forward, or null when there's none.
  previous: number | null
  onSave: (lb: number) => void
}) {
  const [value, setValue] = useState(String(weight))
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const lb = Number(value.trim())
    if (value.trim() === '' || !Number.isFinite(lb) || lb < 0) {
      setError('Enter a weight of zero or more.')
      return
    }
    onSave(lb)
    setError(null)
  }

  const pullForward = () => {
    if (previous == null) return
    setValue(String(previous))
    setError(null)
  }

  return (
    <section
      aria-label="Weight"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Weight</h2>
      <p className="mb-4 text-sm text-slate-500">
        Your weight for this day, in pounds. Use “Pull forward” to copy the previous day's weight.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2" noValidate>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label="Weight (lb)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
        />
        <span className="text-sm text-slate-500">lb</span>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
        >
          Save
        </button>
        <button
          type="button"
          onClick={pullForward}
          disabled={previous == null}
          title={previous == null ? 'No earlier weight to pull forward.' : undefined}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pull forward from previous day
        </button>
        {error && (
          <p role="alert" className="w-full text-sm text-rose-600">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}

type DashboardProps = {
  // When set, the add-food modal opens pre-filled with these macros (e.g. from
  // the Foods page). A targetDate, when present, moves the view to that day so
  // the entry is logged there. onPrefillConsumed lets the parent clear it once
  // handled.
  prefill?: FoodPrefill | null
  onPrefillConsumed?: () => void
  // The day the app lands on (ISO `YYYY-MM-DD`). Defaults to the real current
  // date; injectable so tests can pin a known day instead of the live clock.
  today?: string
}

// The log data the dashboard renders, supplied by the owner (App) so the same
// store instance also feeds the Goals tab — see DashboardView vs Dashboard.
type DashboardViewProps = DashboardProps & {
  loggedFoods: FoodEntry[]
  goalHistory: GoalChange[]
  weights: WeightEntry[]
  addEntry: (entry: FoodEntry) => void
  addEntries: (entries: FoodEntry[]) => void
  updateEntry: (entry: FoodEntry) => void
  deleteEntry: (id: string) => void
  setWeight: (date: string, lb: number) => void
  // Fluid data + mutations. Optional with empty defaults so existing callers and
  // tests that don't exercise the fluid section still type-check.
  fluids?: FluidEntry[]
  targetFluid?: number | null
  addFluid?: (fluid: FluidEntry) => void
  updateFluid?: (fluid: FluidEntry) => void
  deleteFluid?: (id: string) => void
}

/**
 * Presentational dashboard: renders the day's summary and food log from the
 * supplied data. Goals are read-only here — the active goal for the selected
 * date is resolved from the history; editing lives on the Goals tab.
 */
export function DashboardView({
  prefill,
  onPrefillConsumed,
  today = todayIso(),
  loggedFoods,
  goalHistory,
  weights,
  addEntry,
  addEntries,
  updateEntry,
  deleteEntry,
  setWeight,
  fluids = [],
  targetFluid = null,
  addFluid,
  updateFluid,
  deleteFluid,
}: DashboardViewProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  // The fluid add-modal (FAB), and the drink being edited if any.
  const [isFluidFabOpen, setIsFluidFabOpen] = useState(false)
  const [editingFluid, setEditingFluid] = useState<FluidEntry | null>(null)
  // The entry currently being edited, if any. Opens the modal in edit mode.
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Close the calendar popover on an outside click while it's open.
  useEffect(() => {
    if (!isCalendarOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!calendarRef.current?.contains(e.target as Node)) setIsCalendarOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isCalendarOpen])

  // A prefill arriving from the Foods page may target a specific day (the date
  // picked there). Jump the view to it during render — the recommended way to
  // adjust state from a changed prop — keyed on the prefill's identity so each
  // fresh selection re-applies (even to the same day) but a steady prefill or a
  // manual date change isn't overridden. The day then stays in view after submit.
  const [seenPrefill, setSeenPrefill] = useState<FoodPrefill | null | undefined>(null)
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill)
    if (prefill?.targetDate) setSelectedDate(prefill.targetDate)
  }

  // The modal is open when opened via the FAB, when a pre-fill is pending (e.g.
  // a food was picked on the Foods page), or when an entry is being edited.
  const isModalOpen = isFabOpen || prefill != null || editingEntry != null

  // The modal only knows NewFoodInput fields, so drop the Foods-page targetDate
  // before seeding it; undefined when nothing is pending so the FAB opens blank.
  const foodInitialValues = foodFieldsOf(prefill)

  // The fluid modal is open when opened via its FAB or when editing a drink.
  const isFluidModalOpen = isFluidFabOpen || editingFluid != null

  // Closing always clears any pending pre-fill/edit so the FAB next opens blank.
  const closeModal = () => {
    setIsFabOpen(false)
    setEditingEntry(null)
    onPrefillConsumed?.()
  }

  const closeFluidModal = () => {
    setIsFluidFabOpen(false)
    setEditingFluid(null)
  }

  const totals = useMemo(
    () => totalsForDate(loggedFoods, selectedDate),
    [loggedFoods, selectedDate],
  )

  const foodsForDate = useMemo(
    () => loggedFoods.filter((f) => f.date === selectedDate),
    [loggedFoods, selectedDate],
  )

  const fluidsForDate = useMemo(
    () => fluids.filter((f) => f.date === selectedDate),
    [fluids, selectedDate],
  )

  // Calories from the day's drinks, rolled into the summary's calorie figure so
  // caloric drinks (juice, soda, …) count against the calorie goal alongside food.
  const fluidCalories = useMemo(
    () => fluidTotalsForDate(fluids, selectedDate).calories,
    [fluids, selectedDate],
  )

  // The goal in effect on the viewed day, resolved from the dated history. The
  // summary compares against this; it's edited on the Goals tab, not here.
  const goals = useMemo(
    () => goalsForDate(goalHistory, selectedDate),
    [goalHistory, selectedDate],
  )

  // The weight recorded on the viewed day (0 when none), plus the previous
  // weigh-in available to pull forward.
  const dayWeight = useMemo(
    () => weightForDate(weights, selectedDate) ?? 0,
    [weights, selectedDate],
  )
  const previousDayWeight = useMemo(
    () => previousWeight(weights, selectedDate),
    [weights, selectedDate],
  )

  // Stamp new entries with the selected day so they show up in the day on screen.
  const addFood = (input: NewFoodInput) => {
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      date: selectedDate,
      week: isoWeekOf(selectedDate),
      weekday: weekdayOf(selectedDate),
      ...input,
    }
    addEntry(entry)
  }

  const deleteFood = (id: string) => {
    deleteEntry(id)
  }

  // Stamp a new drink with the selected day, mirroring addFood.
  const addDrink = (input: NewFluidInput) => {
    addFluid?.({
      id: crypto.randomUUID(),
      date: selectedDate,
      week: isoWeekOf(selectedDate),
      weekday: weekdayOf(selectedDate),
      ...input,
    })
  }

  // Save a drink edit in place: keep id/date/week/weekday, apply the edited fields.
  const saveFluidEdit = (input: NewFluidInput) => {
    if (!editingFluid) return
    updateFluid?.({
      id: editingFluid.id,
      date: editingFluid.date,
      week: editingFluid.week,
      weekday: editingFluid.weekday,
      ...input,
    })
  }

  // Append the imported entries and jump to the first one's day so the result
  // is immediately visible.
  const handleImport = (entries: FoodEntry[]) => {
    addEntries(entries)
    if (entries.length > 0) setSelectedDate(entries[0].date)
    setIsImportOpen(false)
  }

  // Map an existing entry onto the modal's input shape so it opens pre-filled.
  // Serving/quantity are intentionally omitted — editing treats macros as final.
  const editToInput = (entry: FoodEntry): Partial<NewFoodInput> => ({
    description: entry.description,
    mealType: entry.mealType,
    calories: entry.calories,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
    fiber: entry.fiber,
  })

  // Save an edit in place: keep id/date/week/weekday, apply the edited fields,
  // and drop any serving/quantity label, since hand-edited totals no longer
  // correspond to the original serving math.
  const saveEdit = (input: NewFoodInput) => {
    if (!editingEntry) return
    updateEntry({
      id: editingEntry.id,
      date: editingEntry.date,
      week: editingEntry.week,
      weekday: editingEntry.weekday,
      ...input,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="sticky top-[var(--tab-bar-height)] z-20 mb-6 flex flex-col gap-3 bg-slate-50 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Food Log</h1>
            <p className="text-sm text-slate-500">{formatDateLabel(selectedDate)}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="relative flex items-center gap-1" ref={calendarRef}>
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Choose date"
              aria-haspopup="dialog"
              aria-expanded={isCalendarOpen}
              onClick={() => setIsCalendarOpen((open) => !open)}
              className="min-w-[10rem] rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
            >
              {formatDateLabel(selectedDate)}
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
            >
              Today
            </button>

            {isCalendarOpen && (
              <div
                role="dialog"
                aria-label="Calendar"
                className="absolute right-0 top-full z-10 mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <DayPicker
                  mode="single"
                  required
                  // Match the app's en-GB date formatting: Monday-first weeks
                  // and UK day labels, instead of DayPicker's en-US default.
                  locale={enGB}
                  defaultMonth={isoToDate(selectedDate)}
                  selected={isoToDate(selectedDate)}
                  onSelect={(date) => {
                    setSelectedDate(dateToIso(date))
                    setIsCalendarOpen(false)
                  }}
                />
              </div>
            )}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          {/* Main column: summary + food log */}
          <main className="flex-1 space-y-6">
            {/* Summary card */}
            <section
              aria-label="Daily summary"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Today vs goals</h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {MACRO_KEYS.map((macro) => {
                  const meta = MACRO_META[macro]
                  // Caloric drinks count toward the day's calorie total; other
                  // macros are food-only (drinks carry calories only).
                  const consumed = macro === 'calories' ? totals[macro] + fluidCalories : totals[macro]
                  const goal = goals[macro]
                  const status = goalStatus(macro, consumed, goal)
                  return (
                    <div key={macro} className="rounded-lg bg-slate-50 p-3 text-center">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {meta.label}
                      </dt>
                      <dd className={`mt-1 text-lg font-semibold ${statusClasses[status]}`}>
                        <span aria-label={`${meta.label} consumed`}>{consumed}</span>
                        <span className="text-slate-400"> / {goal}</span>
                        {meta.unit !== 'kcal' && (
                          <span className="text-xs text-slate-400"> {meta.unit}</span>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>

            {/* Weight for the selected day (0 when unset). Keyed on the date so
                navigating days remounts with that day's value. */}
            <WeightCard
              key={selectedDate}
              weight={dayWeight}
              previous={previousDayWeight}
              onSave={(lb) => setWeight(selectedDate, lb)}
            />

            {/* Food log grouped by meal, filtered to the selected date */}
            <MealFeed loggedFoods={foodsForDate} onDelete={deleteFood} onEdit={setEditingEntry} />

            {/* Drinks for the selected day, with oz total + goal progress */}
            <FluidSection
              fluids={fluidsForDate}
              date={selectedDate}
              targetFluid={targetFluid}
              onEdit={setEditingFluid}
              onDelete={(id) => deleteFluid?.(id)}
            />
          </main>
        </div>
      </div>

      {/* Always-reachable actions for the selected day, stacked at the right
          edge (clear of the bottom-corner event-log button). */}
      <div className="fixed right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
        <button
          type="button"
          aria-label="Add food"
          onClick={() => setIsFabOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl leading-none text-white shadow-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Add drink"
          onClick={() => setIsFluidFabOpen(true)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Add drink
        </button>
        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Import CSV
        </button>
      </div>

      {isModalOpen &&
        (editingEntry ? (
          <AddFoodModal
            onAdd={saveEdit}
            onClose={closeModal}
            initialValues={editToInput(editingEntry)}
            editing
          />
        ) : (
          <AddFoodModal onAdd={addFood} onClose={closeModal} initialValues={foodInitialValues} />
        ))}

      {isFluidModalOpen &&
        (editingFluid ? (
          <AddFluidModal
            onAdd={saveFluidEdit}
            onClose={closeFluidModal}
            initialValues={{
              drinkType: editingFluid.drinkType,
              oz: editingFluid.oz,
              calories: editingFluid.calories,
            }}
            editing
          />
        ) : (
          <AddFluidModal onAdd={addDrink} onClose={closeFluidModal} />
        ))}

      {isImportOpen && (
        <BulkImportModal onImport={handleImport} onClose={() => setIsImportOpen(false)} />
      )}
    </div>
  )
}

/**
 * Standalone dashboard wired to its own persisted store. App renders
 * `DashboardView` with a shared store instead, so the Goals tab and the
 * dashboard read and write the same history; this wrapper is for using the
 * dashboard on its own (and in its tests).
 */
function Dashboard(props: DashboardProps = {}) {
  const {
    entries,
    goalHistory,
    weights,
    addEntry,
    addEntries,
    updateEntry,
    deleteEntry,
    setWeight,
    fluids,
    targetFluid,
    addFluid,
    updateFluid,
    deleteFluid,
  } = useFoodLog()
  return (
    <DashboardView
      {...props}
      loggedFoods={entries}
      goalHistory={goalHistory}
      weights={weights}
      addEntry={addEntry}
      addEntries={addEntries}
      updateEntry={updateEntry}
      deleteEntry={deleteEntry}
      setWeight={setWeight}
      fluids={fluids}
      targetFluid={targetFluid}
      addFluid={addFluid}
      updateFluid={updateFluid}
      deleteFluid={deleteFluid}
    />
  )
}

export default Dashboard
