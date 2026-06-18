import { useEffect, useState } from 'react'
import { readLog, type LogEntry, type LogLevel } from './lib/logger'

// Tailwind classes per level so entries are scannable at a glance.
const LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'bg-slate-100 text-slate-600',
  warn: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
}

// Render the ISO timestamp as a readable local time, falling back to the raw
// string if it isn't parseable.
function formatTime(ts: string): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString()
}

/**
 * A floating, always-visible launcher that opens an overlay showing the app's
 * persisted event log (newest-first, last 100 entries). The log is read from
 * localStorage on open and re-read on Refresh, so entries written while the
 * panel is open appear on demand without a full reload.
 */
function LogViewer() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>([])

  // Pull a fresh copy from storage; used on open and on Refresh.
  const refresh = () => setEntries(readLog())

  // Read the log as we open, so the panel always shows current entries.
  const openViewer = () => {
    refresh()
    setOpen(true)
  }

  // Esc closes the panel, matching AddFoodModal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Newest-first for display; the store keeps them chronological.
  const newestFirst = [...entries].reverse()

  return (
    <>
      <button
        type="button"
        aria-label="Open event log"
        onClick={openViewer}
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-slate-500 shadow-md backdrop-blur transition hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        title="Event log"
      >
        {/* List/console glyph */}
        <span aria-hidden className="text-lg leading-none">
          ☰
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Event log"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Event log</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {newestFirst.length === 0 ? (
              <p className="text-sm italic text-slate-400">No log entries yet.</p>
            ) : (
              <ul className="space-y-2 overflow-y-auto">
                {newestFirst.map((entry, i) => (
                  <li
                    key={`${entry.ts}-${i}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${LEVEL_STYLES[entry.level]}`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-xs text-slate-400">{formatTime(entry.ts)}</span>
                    </div>
                    <p className="mt-1 text-slate-800">{entry.message}</p>
                    {entry.context && (
                      <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-500">
                        {JSON.stringify(entry.context)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default LogViewer
