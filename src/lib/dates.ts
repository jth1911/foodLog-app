// Pure date helpers for ISO `YYYY-MM-DD` strings.
// All math runs in UTC so it never shifts across the local timezone / DST.

/**
 * Return the ISO date `n` days from `iso` (negative `n` goes backward).
 * Operates on the date parts via `Date.UTC`, so month/year boundaries
 * normalise correctly without local-time pitfalls.
 */
export function addDays(iso: string, n: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + n))
  return dt.toISOString().slice(0, 10)
}

const weekdayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  timeZone: 'UTC',
})

/** Full weekday name for an ISO date (e.g. "Wednesday"), computed in UTC. */
export function weekdayOf(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return weekdayFormat.format(new Date(Date.UTC(year, month - 1, day)))
}

/**
 * ISO-8601 week number (1–53) for an ISO date. Week 1 is the week containing
 * the year's first Thursday; weeks start on Monday. All math runs in UTC.
 */
export function isoWeekOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  // Shift to the Thursday of this week so the week belongs to the right year.
  const dayNum = (dt.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return 1 + Math.round((dt.getTime() - firstThursday.getTime()) / msPerWeek)
}
