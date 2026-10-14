/** Canonical financial-year helpers. Comparison works lexicographically for YYYY-YY. */

export const DEFAULT_RANGE_START = '2023-24'
export const DEFAULT_RANGE_END = '2026-27'

export function isFyInRange(fy: string, start: string, end: string): boolean {
  return fy >= start && fy <= end
}

export function filterYearsInRange<T extends { financialYear: string }>(
  rows: T[],
  start: string,
  end: string,
): T[] {
  return rows.filter((r) => isFyInRange(r.financialYear, start, end))
}

export function clampRange(start: string, end: string): { start: string; end: string } {
  if (start <= end) return { start, end }
  return { start: end, end: start }
}

/** Most recent N financial years, newest first (YYYY-YY sorts lexicographically). */
export function lastNFinancialYears(years: string[], n = 5): string[] {
  const sorted = [...years].sort()
  return sorted.slice(Math.max(0, sorted.length - n)).reverse()
}
