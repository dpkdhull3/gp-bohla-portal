import type {
  DownloadItem,
  PlanActivityRaw,
  PlanIndex,
  PlanYearFile,
  PlannedActivity,
  PortalMeta,
  SchemeRollup,
  Voucher,
  WorkActivity,
  YearSummary,
} from './types'

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function loadMeta() {
  return fetchJson<PortalMeta>('data/meta.json')
}

let yearSummariesCache: Promise<{ years: YearSummary[] }> | null = null

/** Cached so Strict Mode remounts / multiple pages share one fetch. */
export function loadYearSummaries() {
  if (!yearSummariesCache) {
    yearSummariesCache = fetchJson<{ years: YearSummary[] }>(
      'data/finance/year-summaries.json',
    )
  }
  return yearSummariesCache
}

export function loadVouchers(fy: string) {
  return fetchJson<{
    financialYear: string
    count: number
    totalPaymentInr: number
    records: Voucher[]
  }>(`data/vouchers/${fy}.json`)
}

export async function loadAllVouchers(years: string[]): Promise<Voucher[]> {
  const parts = await Promise.all(
    years.map(async (fy) => {
      try {
        const data = await loadVouchers(fy)
        return data.records
      } catch {
        return [] as Voucher[]
      }
    }),
  )
  return parts.flat()
}

export function loadWorks(fy: string) {
  return fetchJson<{
    financialYear: string
    count: number
    records: WorkActivity[]
  }>(`data/works/${fy}.json`)
}

export async function loadAllWorks(years: string[]): Promise<WorkActivity[]> {
  const parts = await Promise.all(
    years.map(async (fy) => {
      try {
        const data = await loadWorks(fy)
        return data.records
      } catch {
        return [] as WorkActivity[]
      }
    }),
  )
  return parts.flat()
}

export function loadPlan(planYear = '2026-27') {
  return fetchJson<PlanYearFile>(`data/plans/${planYear}.json`)
}

export function loadPlanIndex() {
  return fetchJson<PlanIndex>('data/plans/index.json')
}

export async function loadAllPlans(years: string[]): Promise<PlanYearFile[]> {
  const parts = await Promise.all(
    years.map(async (fy) => {
      try {
        return await loadPlan(fy)
      } catch {
        return null
      }
    }),
  )
  return parts.filter((p): p is PlanYearFile => p !== null)
}

/** Flat activity list helper for pages that only need records. */
export async function loadAllPlanActivities(years: string[]): Promise<PlannedActivity[]> {
  const files = await loadAllPlans(years)
  return files.flatMap((f) => f.records)
}

export function loadSchemes() {
  return fetchJson<{ count: number; records: SchemeRollup[] }>('data/schemes/index.json')
}

export function loadDownloads() {
  return fetchJson<{ records: DownloadItem[] }>('data/downloads.json')
}

/** Resolve a public asset path against Vite BASE_URL. */
export function publicAssetUrl(path: string): string {
  const clean = path.replace(/^\//, '')
  return `${import.meta.env.BASE_URL}${clean}`
}

/** Canonical FY `2024-25` → calendar plan year folder `2024`. */
export function planYearToApiYear(planYear: string): string | null {
  const m = /^(\d{4})-\d{2}$/.exec(planYear)
  return m ? m[1] : null
}

/**
 * Optional enrichment from fetched activitySectionData JSON.
 * Returns null when the raw file was not published.
 */
export async function loadPlanActivityRaw(
  planYear: string,
  activityCode: string,
): Promise<PlanActivityRaw | null> {
  const apiYear = planYearToApiYear(planYear)
  if (!apiYear) return null
  const path = `reports/raw/plan-activities/${apiYear}/activities/${activityCode}.json`
  try {
    return await fetchJson<PlanActivityRaw>(path)
  } catch {
    return null
  }
}
