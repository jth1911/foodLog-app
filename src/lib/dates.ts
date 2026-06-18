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

/**
 * Today's date in the user's *local* timezone as an ISO `YYYY-MM-DD` string.
 * Unlike the UTC math elsewhere in this module, "today" is a question about the
 * local calendar day, so this reads local date parts rather than UTC ones.
 */
export function todayIso(): string {
  return dateToIso(new Date())
}

/**
 * Parse an ISO `YYYY-MM-DD` string into a *local-midnight* `Date`.
 * DayPicker compares and renders days by their local date parts, so a
 * local-midnight Date keeps the selected day aligned with what the user sees.
 */
export function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a `Date` as an ISO `YYYY-MM-DD` string using its *local* date parts.
 * Deliberately avoids `toISOString()`, which serialises in UTC and would shift a
 * local-midnight Date back a day in negative-offset timezones.
 */
export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
 * The first day of the month containing `iso`, as an ISO `YYYY-MM-01` string.
 * Pure string slice — the day part is irrelevant, so no Date math is needed.
 */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/**
 * First-of-month `n` months from the month containing `iso` (negative goes
 * backward). Always returns a `YYYY-MM-01` date, normalising year boundaries via
 * `Date.UTC` so December→January and month-length differences are handled — you
 * never land on an invalid day because the day is pinned to the 1st.
 */
export function addMonths(iso: string, n: number): string {
  const [year, month] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1 + n, 1))
  return dt.toISOString().slice(0, 10)
}

/**
 * Every ISO date in the month containing `iso`, ascending (the 1st through the
 * last day). Length varies with the month — 28/29/30/31 — and leap Februaries
 * resolve correctly because the loop stops as soon as `Date.UTC` rolls into the
 * next month.
 */
export function monthDays(iso: string): string[] {
  const [year, month] = iso.split('-').map(Number)
  const days: string[] = []
  for (let day = 1; ; day++) {
    const dt = new Date(Date.UTC(year, month - 1, day))
    if (dt.getUTCMonth() !== month - 1) break
    days.push(dt.toISOString().slice(0, 10))
  }
  return days
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
