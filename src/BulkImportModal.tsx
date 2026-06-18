import { useEffect, useState, type ChangeEvent } from 'react'
import { type FoodEntry } from './lib/nutrition'
import { isoWeekOf, weekdayOf } from './lib/dates'
import { parseCsv, type ImportResult, type ParsedEntry } from './lib/csvImport'

type BulkImportModalProps = {
  // Receives the validated rows stamped into full FoodEntry records.
  onImport: (entries: FoodEntry[]) => void
  onClose: () => void
}

// Stamp a parsed row with the fields the CSV doesn't carry: a fresh id and the
// week/weekday derived from its date — mirroring Dashboard.addFood.
function toFoodEntry(parsed: ParsedEntry): FoodEntry {
  return {
    id: crypto.randomUUID(),
    week: isoWeekOf(parsed.date),
    weekday: weekdayOf(parsed.date),
    ...parsed,
  }
}

/**
 * A modal for bulk-importing food entries from a CSV file. Parses and validates
 * the file entirely client-side, shows a preview (valid count + per-row errors),
 * and on confirm hands the valid rows up as FoodEntry records. Importing only
 * the valid rows; bad rows are reported, never silently dropped, and a parse
 * failure surfaces inline rather than crashing.
 */
function BulkImportModal({ onImport, onClose }: BulkImportModalProps) {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Esc closes, matching AddFoodModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    try {
      const text = await file.text()
      setResult(parseCsv(text))
    } catch {
      setResult(null)
      setFileError('Could not read that file. Please choose a valid .csv file.')
    }
  }

  const handleImport = () => {
    if (!result || result.valid.length === 0) return
    onImport(result.valid.map(toFoodEntry))
    onClose()
  }

  const validCount = result?.valid.length ?? 0
  const errorCount = result?.errors.length ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import food entries from CSV"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import CSV</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Choose a CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose CSV file"
            onChange={handleFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Columns: Date, Meal Type, Food Description, Fat, Carbs, Protein, Calories, Fiber.
        </p>

        {fileError && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {fileError}
          </p>
        )}

        {result && (
          <div className="mt-4 flex min-h-0 flex-col">
            <p className="text-sm text-slate-700">
              Found {validCount + errorCount} row{validCount + errorCount === 1 ? '' : 's'} —{' '}
              <span className="font-semibold text-emerald-600">{validCount} valid</span>,{' '}
              <span className="font-semibold text-rose-600">
                {errorCount} error{errorCount === 1 ? '' : 's'}
              </span>
              .
            </p>

            {errorCount > 0 && (
              <ul
                aria-label="Import errors"
                className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700"
              >
                {result.errors.map((err, i) => (
                  <li key={`${err.row}-${i}`}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0}
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validCount > 0 ? `Import ${validCount} entr${validCount === 1 ? 'y' : 'ies'}` : 'Import'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkImportModal
