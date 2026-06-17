import { useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker } from '@daypicker/react'
import { enGB } from 'date-fns/locale'
import '@daypicker/react/style.css'
import {
  MACRO_KEYS,
  MACRO_META,
  goalStatus,
  totalsForDate,
  type FoodEntry,
  type MacroKey,
} from './lib/nutrition'
import MealFeed from './MealFeed'
import AddFoodModal, { type NewFoodInput } from './AddFoodModal'
import { addDays, dateToIso, isoToDate, isoWeekOf, todayIso, weekdayOf } from './lib/dates'
import { useFoodLog } from './useFoodLog'
import { useAuth } from './lib/useAuth'
import { firestoreRepo, type FoodLogRepository } from './lib/foodLogRepo'
import { db } from './lib/firebase'
import SignInControl from './SignInControl'

// Builds the live Firestore-backed store for a signed-in user. Module-scoped so
// its identity is stable across renders. `db` is non-null whenever a user is
// signed in (sign-in requires a configured Firebase app).
const defaultMakeRepo = (uid: string): FoodLogRepository => firestoreRepo(db!, uid)

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

function Dashboard({ prefill, onPrefillConsumed, today = todayIso() }: DashboardProps = {}) {
  const { user, signIn, signOut, ready } = useAuth()
  // Signed out → local seed/demo state; signed in → the user's synced cloud data.
  const { entries: loggedFoods, goals, addEntry, deleteEntry, setGoals } = useFoodLog({
    uid: user?.uid ?? null,
    makeRepo: defaultMakeRepo,
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [isFabOpen, setIsFabOpen] = useState(false)
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

  // The modal is open when opened via the FAB or when a pre-fill is pending
  // (e.g. a food was picked on the Foods page) — no effect needed to sync state.
  const isModalOpen = isFabOpen || prefill != null

  // Closing always clears any pending pre-fill so the FAB next opens blank.
  const closeModal = () => {
    setIsFabOpen(false)
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

  const updateGoal = (macro: MacroKey, raw: string) => {
    const value = Number(raw)
    setGoals({ ...goals, [macro]: Number.isFinite(value) ? value : 0 })
  }

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

  // While Firebase is still resolving the initial auth state, hold off rendering
  // so a returning signed-in user doesn't flash the signed-out demo before their
  // cloud data loads. (When Firebase isn't configured, `ready` is true from the
  // start, so this never blocks the local demo.)
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    )
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
            <SignInControl user={user} onSignIn={signIn} onSignOut={signOut} />
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

        <div className="flex flex-col gap-6 lg:flex-row">
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
            <MealFeed loggedFoods={foodsForDate} onDelete={deleteFood} />
          </main>

          {/* Goals side panel */}
          <aside
            aria-label="Goals"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-64"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Goals</h2>
            <div className="space-y-3">
              {MACRO_KEYS.map((macro) => {
                const meta = MACRO_META[macro]
                const arrow = meta.direction === 'min' ? '≥' : '≤'
                return (
                  <label key={macro} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">
                      {meta.label} <span className="text-slate-400">{arrow}</span>
                    </span>
                    <input
                      type="number"
                      aria-label={`${meta.label} goal`}
                      value={goals[macro]}
                      onChange={(e) => updateGoal(macro, e.target.value)}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                )
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* Always-reachable trigger to log a new food on the selected day. */}
      <button
        type="button"
        aria-label="Add food"
        onClick={() => setIsFabOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl leading-none text-white shadow-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        +
      </button>

      {isModalOpen && (
        <AddFoodModal onAdd={addFood} onClose={closeModal} initialValues={prefill ?? undefined} />
      )}
    </div>
  )
}

export default Dashboard
