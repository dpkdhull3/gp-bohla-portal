export function formatInr(value: number | null | undefined, locale = 'hi-IN'): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Compact ₹ display for narrow KPI cards (avoids overflow clipping). */
export function formatInrCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `₹${Math.round(value)}`
}

export function formatNumber(value: number | null | undefined, locale = 'hi-IN'): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return new Intl.NumberFormat(locale).format(value)
}
