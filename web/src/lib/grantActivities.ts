import type { PlannedActivity, Voucher, WorkActivity } from './types'

export type GrantStatus = 'done' | 'unpaid' | 'not_done'

export type GrantActivity = {
  code: string
  title: string
  description: string | null
  scheme: string
  sector: string
  planYear?: string
  workYear?: string
  /** eGramSwaraj Activity N within the plan year (1-based). */
  activityNo?: number | null
  plan?: PlannedActivity
  work?: WorkActivity
  vouchers: Voucher[]
  approvedInr: number | null
  spentInr: number
  status: GrantStatus
  outsidePlan: boolean
}

export function buildGrantActivities(
  planByCode: Map<string, PlannedActivity>,
  workByCode: Map<string, WorkActivity>,
  vouchers: Voucher[],
  activeYears: string[],
): GrantActivity[] {
  const activityCodes = new Set<string>([...planByCode.keys(), ...workByCode.keys()])
  const vouchersByCode = new Map<string, Voucher[]>()
  for (const v of vouchers) {
    const code = v.workCode?.trim()
    if (!code || !activityCodes.has(code)) continue
    const list = vouchersByCode.get(code) ?? []
    list.push(v)
    vouchersByCode.set(code, list)
  }

  const rows: GrantActivity[] = []
  for (const code of activityCodes) {
    const plan = planByCode.get(code)
    const work = workByCode.get(code)
    const inPeriod =
      (plan && activeYears.includes(plan.planYear)) ||
      (work && activeYears.includes(work.financialYear))
    if (!inPeriod) continue

    const displayVouchers = [...(vouchersByCode.get(code) ?? [])].sort((a, b) =>
      b.voucherDate.localeCompare(a.voucherDate),
    )
    const spentInr = displayVouchers.reduce((s, v) => s + (v.amountInr || 0), 0)
    const approvedInr =
      plan?.estimatedCostInr != null
        ? plan.estimatedCostInr
        : work?.adminApprovedCostInr != null
          ? work.adminApprovedCostInr
          : null

    let status: GrantStatus
    if (work) {
      status = displayVouchers.length > 0 ? 'done' : 'unpaid'
    } else {
      status = 'not_done'
    }

    const title = plan?.activityName || work?.activityName || code
    const rawDesc = (plan?.activityDescription || '').trim()
    const description =
      rawDesc && rawDesc.toLowerCase() !== title.trim().toLowerCase() ? rawDesc : null

    rows.push({
      code,
      title,
      description,
      scheme: plan?.schemeName || work?.schemeName || '—',
      sector: plan?.sector || work?.focusArea || '—',
      planYear: plan?.planYear,
      workYear: work?.financialYear,
      activityNo: plan?.activityNo ?? null,
      plan,
      work,
      vouchers: displayVouchers,
      approvedInr,
      spentInr,
      status,
      outsidePlan: !plan && Boolean(work),
    })
  }

  rows.sort((a, b) => (b.approvedInr || 0) - (a.approvedInr || 0))
  return rows
}

/** Build one grant across all loaded years (for detail deep links). */
export function buildGrantActivityByCode(
  code: string,
  planByCode: Map<string, PlannedActivity>,
  workByCode: Map<string, WorkActivity>,
  vouchers: Voucher[],
): GrantActivity | null {
  const allYears = new Set<string>()
  for (const p of planByCode.values()) allYears.add(p.planYear)
  for (const w of workByCode.values()) allYears.add(w.financialYear)
  for (const v of vouchers) allYears.add(v.financialYear)
  const years = [...allYears]
  const match = buildGrantActivities(planByCode, workByCode, vouchers, years).find(
    (g) => g.code === code,
  )
  return match ?? null
}

export function indexByActivityCode<T extends { activityCode: string }>(
  items: T[],
): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    if (!map.has(item.activityCode)) map.set(item.activityCode, item)
  }
  return map
}
