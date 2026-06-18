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
  // The single target weight in pounds, or null when none is set yet.
  targetWeight: number | null
  onSetTargetWeight: (lb: number) => void
  // The single daily fluid target in fluid ounces, or null when none is set yet.
  targetFluid: number | null
  onSetTargetFluid: (oz: number) => void
  // The date the add form defaults to; injectable so tests pin a known day.
  today?: string
}

/**
 * The target-weight card: a single editable goal weight in pounds (not
 * effective-dated like the macro goals — one value for v1). The report charts
 * overlay it as a reference line. The caller keys this on the stored value, so a
 * saved/loaded change remounts it with the new number.
 */
function TargetWeightCard({
  targetWeight,
  onSave,
}: {
  targetWeight: number | null
  onSave: (lb: number) => void
}) {
  const [value, setValue] = useState(targetWeight != null ? String(targetWeight) : '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const lb = Number(value.trim())
    if (value.trim() === '' || !Number.isFinite(lb) || lb <= 0) {
      setError('Enter a target weight greater than zero.')
      return
    }
    onSave(lb)
    setError(null)
  }

  return (
    <section
      aria-label="Target weight"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-72"
    >
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Target weight</h2>
      <p className="mb-4 text-sm text-slate-500">
        Shown as a reference line on the weekly and monthly weight charts.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2" noValidate>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label="Target weight (lb)"
          placeholder="—"
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
        {error && (
          <p role="alert" className="w-full text-sm text-rose-600">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}

/**
 * The daily fluid-target card: a single editable goal volume in fluid ounces
 * (not effective-dated — one value, like the target weight). The report charts
 * overlay it as a reference line. Keyed by the caller on the stored value, so a
 * saved/loaded change remounts it with the new number.
 */
function TargetFluidCard({
  targetFluid,
  onSave,
}: {
  targetFluid: number | null
  onSave: (oz: number) => void
}) {
  const [value, setValue] = useState(targetFluid != null ? String(targetFluid) : '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const oz = Number(value.trim())
    if (value.trim() === '' || !Number.isFinite(oz) || oz <= 0) {
      setError('Enter a fluid target greater than zero.')
      return
    }
    onSave(oz)
    setError(null)
  }

  return (
    <section
      aria-label="Target fluid"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-72"
    >
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Daily fluid target</h2>
      <p className="mb-4 text-sm text-slate-500">
        Your daily hydration goal. Tracked on the dashboard and shown as a reference line on the
        report fluid charts.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2" noValidate>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label="Target fluid (fl oz)"
          placeholder="—"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-right text-slate-800 focus:border-slate-500 focus:outline-none"
        />
        <span className="text-sm text-slate-500">fl oz</span>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none"
        >
          Save
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
function GoalsPage({
  goalHistory,
  onAdd,
  onDelete,
  targetWeight,
  onSetTargetWeight,
  targetFluid,
  onSetTargetFluid,
  today = todayIso(),
}: GoalsPageProps) {
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

        <div className="flex flex-col gap-6">
        {/* Single target weight. Keyed on the stored value so a save/load
            remounts the field with the new number. */}
        <TargetWeightCard
          key={targetWeight ?? 'none'}
          targetWeight={targetWeight}
          onSave={onSetTargetWeight}
        />

        {/* Single daily fluid target. Keyed on the stored value like the weight
            target so a save/load remounts the field with the new number. */}
        <TargetFluidCard
          key={`fluid-${targetFluid ?? 'none'}`}
          targetFluid={targetFluid}
          onSave={onSetTargetFluid}
        />

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
    </div>
  )
}

export default GoalsPage
