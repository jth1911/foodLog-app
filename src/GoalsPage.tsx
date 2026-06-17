import { useState, type FormEvent } from 'react'
import {
  MACRO_KEYS,
  MACRO_META,
  GOALS_EPOCH,
  DEFAULT_GOALS,
  type GoalChange,
  type Goals,
  type MacroKey,
} from './lib/nutrition'
import { todayIso } from './lib/dates'

type GoalsPageProps = {
  goalHistory: GoalChange[]
  onAdd: (effectiveDate: string, goals: Goals) => void
  onDelete: (effectiveDate: string) => void
  // The date the add form defaults to; injectable so tests pin a known day.
  today?: string
}

// Readable label for an effective date, formatted in UTC to match the rest of
// the app. The seeded/migrated default entry uses a sentinel date that would
// read as a meaningless "0001" — show it as the initial goal instead.
const dateLabelFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatEffectiveDate(iso: string): string {
  if (iso === GOALS_EPOCH) return 'Initial goal'
  const [year, month, day] = iso.split('-').map(Number)
  return dateLabelFormat.format(new Date(Date.UTC(year, month - 1, day)))
}

const blankMacros: Record<MacroKey, string> = {
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: '',
}

/**
 * The Goals tab: a newest-first history of effective-dated goal changes, each
 * deletable (except the last, so every date always resolves to a goal), plus a
 * form to append a new change. Owns only its draft form state — the history is
 * the caller's single source of truth, mutated via onAdd/onDelete.
 */
function GoalsPage({ goalHistory, onAdd, onDelete, today = todayIso() }: GoalsPageProps) {
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [macros, setMacros] = useState<Record<MacroKey, string>>(blankMacros)
  const [error, setError] = useState<string | null>(null)

  // Newest first for display; the stored history is sorted ascending.
  const rows = [...goalHistory].reverse()
  const canDelete = goalHistory.length > 1

  const setMacro = (key: MacroKey, value: string) =>
    setMacros((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!effectiveDate) {
      setError('Please choose an effective date.')
      return
    }

    const parsed = {} as Goals
    for (const key of MACRO_KEYS) {
      const raw = macros[key].trim()
      const value = Number(raw)
      // Every macro must be entered as a non-negative number — a goal form has
      // no sensible "blank means 0" default the way logging a food does.
      if (raw === '' || !Number.isFinite(value) || value < 0) {
        setError(`${MACRO_META[key].label} must be a non-negative number.`)
        return
      }
      parsed[key] = value
    }

    onAdd(effectiveDate, parsed)
    setMacros(blankMacros)
    setError(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Goals</h1>
        <p className="text-sm text-slate-500">
          Each change applies from its date forward, until the next one. Days are measured against
          the goal in effect on that day.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* History list, newest first */}
        <section aria-label="Goal history" className="flex-1 space-y-3">
          {rows.map((entry) => (
            <div
              key={entry.effectiveDate}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{formatEffectiveDate(entry.effectiveDate)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {MACRO_KEYS.map((key) => {
                    const meta = MACRO_META[key]
                    const unit = meta.unit === 'kcal' ? '' : ` ${meta.unit}`
                    return `${meta.label} ${entry.goals[key]}${unit}`
                  }).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete goal change ${formatEffectiveDate(entry.effectiveDate)}`}
                onClick={() => onDelete(entry.effectiveDate)}
                disabled={!canDelete}
                title={canDelete ? undefined : 'The last remaining goal cannot be deleted.'}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          ))}
        </section>

        {/* Add-goal-change form */}
        <aside
          aria-label="Add goal change"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-72"
        >
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add goal change</h2>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">Effective date</span>
              <input
                type="date"
                aria-label="Effective date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </label>

            {MACRO_KEYS.map((key) => {
              const meta = MACRO_META[key]
              const arrow = meta.direction === 'min' ? '≥' : '≤'
              return (
                <label key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">
                    {meta.label} <span className="text-slate-400">{arrow}</span>
                    {meta.unit !== 'kcal' && <span className="text-slate-400"> ({meta.unit})</span>}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={`${meta.label} goal`}
                    placeholder={String(DEFAULT_GOALS[key])}
                    value={macros[key]}
                    onChange={(e) => setMacro(key, e.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                </label>
              )
            })}

            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
            >
              Add goal change
            </button>
          </form>
        </aside>
      </div>
    </div>
  )
}

export default GoalsPage
