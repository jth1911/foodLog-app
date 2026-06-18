// A tiny, framework-free event logger backed by localStorage, so the app keeps
// a browsable record of what it did (and what failed) across page reloads.
// Kept out of React — like nutrition.ts / foods.ts / gemini.ts — so it can be
// called from anywhere (including the framework-free gemini client) and unit-
// tested in isolation. The viewer reads it via readLog(); writers call log().

// Versioned key, matching the foodlog:*:v1 convention in foodLogRepo.ts.
export const LOG_KEY = 'foodlog:log:v1'

// Keep only the most recent entries so the key never grows unbounded.
export const LOG_CAP = 100

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = {
  ts: string // ISO timestamp, e.g. "2026-06-17T08:30:00.000Z"
  level: LogLevel
  message: string
  // Optional structured detail, e.g. the food + serving sent to Gemini or a
  // raw error message. Kept loose since callers log varied shapes.
  context?: Record<string, unknown>
}

// Guard against hosts without localStorage, mirroring foodLogRepo's approach.
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// A stored entry must carry a string ts/message and a valid level; anything else
// is dropped so a tampered key can't feed bad shapes to the viewer.
const LEVELS: LogLevel[] = ['info', 'warn', 'error']
function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.ts === 'string' &&
    typeof v.message === 'string' &&
    LEVELS.includes(v.level as LogLevel)
  )
}

/**
 * The stored log in chronological (append) order. Returns an empty array when
 * nothing has been logged or the stored value is missing/corrupt/wrong-shaped —
 * so a bad key degrades to "no history" rather than crashing the viewer.
 */
export function readLog(): LogEntry[] {
  const storage = getStorage()
  if (!storage) return []
  const raw = storage.getItem(LOG_KEY)
  if (raw == null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLogEntry)
  } catch {
    return []
  }
}

/**
 * Append one entry, trimming to the last LOG_CAP (oldest dropped from the front).
 * Stamps the current time. Never throws — logging must not be able to break the
 * thing it's recording (e.g. on a storage quota error).
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const storage = getStorage()
  if (!storage) return
  const entry: LogEntry = { ts: new Date().toISOString(), level, message }
  if (context !== undefined) entry.context = context
  const next = [...readLog(), entry].slice(-LOG_CAP)
  try {
    storage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    // Don't let a failed log write surface to the user.
  }
}

/** Empty the log. */
export function clearLog(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(LOG_KEY)
  } catch {
    // Best-effort.
  }
}
