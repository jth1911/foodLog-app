import { useEffect, useMemo, useRef, useState } from 'react'
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
import AddFoodModal, { type NewFoodInput } from './AddFoodModal'
import BulkImportModal from './BulkImportModal'
import { addDays, dateToIso, isoToDate, isoWeekOf, todayIso, weekdayOf } from './lib/dates'
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

type DashboardProps = {
  // When set, the add-food modal opens pre-filled with these macros (e.g. from
  // the Foods page). onPrefillConsumed lets the parent clear it once handled.
  prefill?: Partial<NewFoodInput> | null
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
  addEntry: (entry: FoodEntry) => void
  addEntries: (entries: FoodEntry[]) => void
  updateEntry: (entry: FoodEntry) => void
  deleteEntry: (id: string) => void
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
  addEntry,
  addEntries,
  updateEntry,
  deleteEntry,
}: DashboardViewProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
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

  // The modal is open when opened via the FAB, when a pre-fill is pending (e.g.
  // a food was picked on the Foods page), or when an entry is being edited.
  const isModalOpen = isFabOpen || prefill != null || editingEntry != null

  // Closing always clears any pending pre-fill/edit so the FAB next opens blank.
  const closeModal = () => {
    setIsFabOpen(false)
    setEditingEntry(null)
    onPrefillConsumed?.()
  }

  const totals = useMemo(
    () => totalsForDate(loggedFoods, selectedDate),
    [loggedFoods, selectedDate],
  )

  const foodsForDate = useMemo(
    () => loggedFoods.filter((f) => f.date === selectedDate),
    [loggedFoods, selectedDate],
  )

  // The goal in effect on the viewed day, resolved from the dated history. The
  // summary compares against this; it's edited on the Goals tab, not here.
  const goals = useMemo(
    () => goalsForDate(goalHistory, selectedDate),
    [goalHistory, selectedDate],
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
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
                  const consumed = totals[macro]
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

            {/* Food log grouped by meal, filtered to the selected date */}
            <MealFeed loggedFoods={foodsForDate} onDelete={deleteFood} onEdit={setEditingEntry} />
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
          <AddFoodModal onAdd={addFood} onClose={closeModal} initialValues={prefill ?? undefined} />
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
  const { entries, goalHistory, addEntry, addEntries, updateEntry, deleteEntry } = useFoodLog()
  return (
    <DashboardView
      {...props}
      loggedFoods={entries}
      goalHistory={goalHistory}
      addEntry={addEntry}
      addEntries={addEntries}
      updateEntry={updateEntry}
      deleteEntry={deleteEntry}
    />
  )
}

export default Dashboard
