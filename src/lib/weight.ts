// Pure, framework-free body-weight logic. Kept separate from the components so
// the carry-forward rule, the materialisation that persists it, and the trend
// smoothing can all be unit-tested in isolation — mirroring nutrition.ts and the
// report aggregators.

import { weekdayOf } from './dates'

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
 * The weight explicitly recorded on `date`, or `null` when that day has no
 * weigh-in. There is no automatic carry-forward — an unlogged day is genuinely
 * empty (callers default it to 0 / leave a chart gap). Carrying a value forward
 * is a manual action via `previousWeight` + the dashboard's "pull forward"
 * button.
 */
export function weightForDate(history: WeightEntry[], date: string): number | null {
  const entry = history.find((e) => e.date === date)
  return entry ? entry.lb : null
}

/**
 * The most recent recorded weight strictly before `date`, or `null` when there
 * is no earlier weigh-in. Backs the "pull forward from the previous day" button:
 * it copies the last known weight into the selected day so a gap can be filled
 * without retyping. ISO date strings compare lexicographically, so this is a
 * plain string scan; sorts defensively rather than trusting caller order.
 */
export function previousWeight(history: WeightEntry[], date: string): number | null {
  const sorted = [...history].sort(byDate)
  let previous: number | null = null
  for (const entry of sorted) {
    if (entry.date < date) previous = entry.lb
    else break
  }
  return previous
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
  // The weight recorded that day, or null when there was no weigh-in.
  lb: number | null
  // The smoothed trend (TREND_WINDOW-day SMA over recorded days), or null when
  // the trailing window holds no data.
  trend: number | null
}

/**
 * Per-day weight series across `dates`: each day's *recorded* weight paired with
 * the smoothed trend, ready for the report line charts. Days with no weigh-in
 * are `null` (the chart leaves a gap and `connectNulls` bridges it) — the charts
 * plot only what was actually logged, with no carry-forward.
 */
export function weightSeries(history: WeightEntry[], dates: string[]): WeightPoint[] {
  const lbs = dates.map((date) => weightForDate(history, date))
  const trend = movingAverage(lbs, TREND_WINDOW)
  return dates.map((date, i) => ({
    date,
    weekday: weekdayOf(date),
    lb: lbs[i],
    trend: trend[i],
  }))
}
