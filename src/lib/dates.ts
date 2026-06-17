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
