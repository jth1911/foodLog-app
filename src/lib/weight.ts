// Pure, framework-free body-weight logic. Kept separate from the components so
// the carry-forward rule, the materialisation that persists it, and the trend
// smoothing can all be unit-tested in isolation — mirroring nutrition.ts and the
// report aggregators.

import { addDays, weekdayOf } from './dates'

// A single day's weight in pounds, keyed by ISO `YYYY-MM-DD`. At most one per
// date; the store keeps them sorted ascending, like the goal history.
export type WeightEntry = {
  date: string // ISO `YYYY-MM-DD`
  lb: number
}

// Trailing window (days) for the smoothed trend line. A 7-day simple moving
// average cuts daily weigh-in noise without lagging too far behind real change.
export const TREND_WINDOW = 7

const byDate = (a: WeightEntry, b: WeightEntry) => a.date.localeCompare(b.date)

/**
 * The weight in effect on `date`: the latest entry on or before it, or `null`
 * for a date earlier than every entry (before the first-ever weigh-in there's
 * genuinely nothing to carry forward). This is the "use the previous day's
 * weight" rule, expressed as a pure resolution — it works whether or not the
 * gaps have been materialised, mirroring goalsForDate in nutrition.ts.
 *
 * ISO date strings compare lexicographically, so this is a plain string scan.
 * Sorts defensively rather than trusting callers to pass a sorted list.
 */
export function resolveWeight(history: WeightEntry[], date: string): number | null {
  const sorted = [...history].sort(byDate)
  let resolved: number | null = null
  for (const entry of sorted) {
    if (entry.date <= date) resolved = entry.lb
    else break
  }
  return resolved
}

/**
 * Materialise the carry-forward copies: every day from the first weigh-in up to
 * (and including) `today` becomes a real, editable entry, gap days inheriting
 * the previous day's weight. Explicit entries are preserved verbatim; only the
 * gaps between them are filled.
 *
 * Days *after* `today` are never back-filled — that would write future-dated
 * phantom rows — but an explicitly-entered future weight is kept as-is. The
 * function is idempotent on already-materialised input and simply extends the
 * fill forward as `today` advances.
 */
export function materialiseWeights(history: WeightEntry[], today: string): WeightEntry[] {
  if (history.length === 0) return []
  const sorted = [...history].sort(byDate)
  const explicitByDate = new Map(sorted.map((e) => [e.date, e.lb]))
  const first = sorted[0].date

  const filled: WeightEntry[] = []
  // Fill first → today inclusive. Skipped entirely when the first entry is
  // itself in the future (all weigh-ins ahead of today).
  let carried: number | null = null
  for (let day = first; day <= today; day = addDays(day, 1)) {
    const explicit = explicitByDate.get(day)
    if (explicit !== undefined) carried = explicit
    // carried is non-null from the first iteration onward, since `first` is an
    // explicit entry and the loop starts there.
    if (carried !== null) filled.push({ date: day, lb: carried })
  }
  // Preserve any explicit future entries without inventing the days between.
  for (const entry of sorted) {
    if (entry.date > today) filled.push(entry)
  }
  return filled
}

/**
 * Trailing simple moving average over a numeric series that may contain `null`
 * holes (days before the first weigh-in). Each point averages the available
 * real values in the trailing `window`; a window with no real values yields
 * `null`. Partial windows at the start average whatever is there so far.
 */
export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1).filter((v): v is number => v !== null)
    if (slice.length === 0) return null
    const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length
    return Math.round(mean * 10) / 10
  })
}

export type WeightPoint = {
  date: string
  weekday: string
  // The carried-forward weight for the day, or null before the first weigh-in.
  lb: number | null
  // The smoothed trend (TREND_WINDOW-day SMA), or null before any data.
  trend: number | null
}

/**
 * Per-day weight series across `dates`: each day's carried-forward weight paired
 * with the smoothed trend, ready for the report line charts. Days before the
 * first-ever entry are `null` on both, so the chart leaves a leading gap rather
 * than inventing weights that never existed.
 */
export function weightSeries(history: WeightEntry[], dates: string[]): WeightPoint[] {
  const lbs = dates.map((date) => resolveWeight(history, date))
  const trend = movingAverage(lbs, TREND_WINDOW)
  return dates.map((date, i) => ({
    date,
    weekday: weekdayOf(date),
    lb: lbs[i],
    trend: trend[i],
  }))
}
