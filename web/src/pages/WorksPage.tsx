import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadAllVouchers, loadAllWorks, publicAssetUrl } from '../lib/data'
import { formatInr, formatInrCompact, formatNumber } from '../lib/format'
import type { PlanYearFile, PlannedActivity, Voucher, WorkActivity } from '../lib/types'

type ActivityStatus = 'done' | 'unpaid' | 'not_done'

type UnifiedActivity = {
  code: string
  title: string
  description: string | null
  scheme: string
  sector: string
  planYear?: string
  workYear?: string
  plan?: PlannedActivity
  work?: WorkActivity
  vouchers: Voucher[]
  approvedInr: number | null
  spentInr: number
  status: ActivityStatus
  outsidePlan: boolean
}

type FilterChip = 'all' | 'not_done' | 'done' | 'unpaid' | 'unlinked'
type ViewMode = 'activities' | 'vouchers' | 'work_payments' | 'pdf' | 'sheet'

type VoucherLinkKind = 'linked_same_fy' | 'linked_other_fy' | 'plan_only' | 'unlinked'

type VoucherLinkInfo = {
  kind: VoucherLinkKind
  workYear?: string
  planYear?: string
  workName?: string
}

function viewFromSearch(raw: string | null): ViewMode {
  if (raw === 'pdf' || raw === 'docs') return 'pdf'
  if (raw === 'sheet') return 'sheet'
  if (raw === 'vouchers') return 'vouchers'
  if (raw === 'work_payments' || raw === 'by_work') return 'work_payments'
  return 'activities'
}

function spendRatio(approved: number | null, spent: number): number | null {
  if (approved === null || approved <= 0) return null
  return Math.min(100, Math.round((spent / approved) * 100))
}

function resolveVoucherLink(
  v: Voucher,
  workByCode: Map<string, WorkActivity>,
  planByCode: Map<string, PlannedActivity>,
): VoucherLinkInfo {
  const code = v.workCode?.trim()
  if (!code) return { kind: 'unlinked' }
  const work = workByCode.get(code)
  if (work) {
    if (work.financialYear === v.financialYear) {
      return { kind: 'linked_same_fy', workYear: work.financialYear, workName: work.activityName }
    }
    return { kind: 'linked_other_fy', workYear: work.financialYear, workName: work.activityName }
  }
  const plan = planByCode.get(code)
  if (plan) {
    return { kind: 'plan_only', planYear: plan.planYear }
  }
  return { kind: 'unlinked' }
}

function StatusGlyph({ status, label }: { status: ActivityStatus; label: string }) {
  const symbol = status === 'done' ? '✓' : status === 'unpaid' ? '●' : '✕'
  return (
    <span
      className={`activity-status activity-status-${status}`}
      title={label}
      aria-label={label}
    >
      {symbol}
    </span>
  )
}

function VoucherMiniTable({
  rows,
  locale,
  unlinked,
}: {
  rows: Voucher[]
  locale: string
  unlinked?: boolean
}) {
  const { t } = useTranslation()
  const total = rows.reduce((s, v) => s + (v.amountInr || 0), 0)

  return (
    <div className="table-scroll work-voucher-table-wrap">
      <table
        className={`data-table-dense work-voucher-table${unlinked ? ' work-voucher-table-unlinked' : ''}`}
      >
        <thead>
          <tr>
            <th>{t('vouchers.voucherNo')}</th>
            <th>{t('vouchers.date')}</th>
            <th>{t('common.amountInr')}</th>
            <th>{t('vouchers.majorHead')}</th>
            <th>{t('vouchers.objectHead')}</th>
            {unlinked ? <th>{t('vouchers.workCode')}</th> : null}
            <th>FY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.vId}
              className={unlinked ? 'voucher-row-unlinked' : undefined}
              title={unlinked ? t('vouchers.unlinkedTitle') : undefined}
            >
              <td>{v.voucherNo}</td>
              <td>{v.voucherDate}</td>
              <td className="cell-strong">{formatInr(v.amountInr, locale)}</td>
              <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
              <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
              {unlinked ? <td>{v.workCode ?? '—'}</td> : null}
              <td>{v.financialYear}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="cell-strong" colSpan={2}>
              {t('vouchers.totalRow')}
            </td>
            <td className="cell-strong">{formatInr(total, locale)}</td>
            <td colSpan={unlinked ? 4 : 3} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function WorksPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [searchParams, setSearchParams] = useSearchParams()
  const [works, setWorks] = useState<WorkActivity[]>([])
  const [plans, setPlans] = useState<PlanYearFile[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterChip>('all')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>(() => viewFromSearch(searchParams.get('view')))
  const [docYear, setDocYear] = useState<string | null>(null)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    setViewMode(viewFromSearch(searchParams.get('view')))
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    setLoading(true)
    Promise.all([loadAllWorks(fys), loadAllPlans(fys), loadAllVouchers(fys)])
      .then(([w, p, v]) => {
        if (cancelled) return
        setWorks(w)
        setPlans(p)
        setVouchers(v)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meta])

  const workByCode = useMemo(() => {
    const map = new Map<string, WorkActivity>()
    for (const w of works) {
      if (!map.has(w.activityCode)) map.set(w.activityCode, w)
    }
    return map
  }, [works])

  const planByCode = useMemo(() => {
    const map = new Map<string, PlannedActivity>()
    for (const file of plans) {
      for (const a of file.records || []) {
        if (!map.has(a.activityCode)) map.set(a.activityCode, a)
      }
    }
    return map
  }, [plans])

  const allWorkCodes = useMemo(() => new Set(workByCode.keys()), [workByCode])

  const vouchersByCode = useMemo(() => {
    const map = new Map<string, Voucher[]>()
    for (const v of vouchers) {
      if (!v.workCode || !allWorkCodes.has(v.workCode)) continue
      const list = map.get(v.workCode) ?? []
      list.push(v)
      map.set(v.workCode, list)
    }
    return map
  }, [vouchers, allWorkCodes])

  const activities = useMemo(() => {
    const codes = new Set<string>([...planByCode.keys(), ...workByCode.keys()])
    const rows: UnifiedActivity[] = []

    for (const code of codes) {
      const plan = planByCode.get(code)
      const work = workByCode.get(code)
      const allVouchers = vouchersByCode.get(code) ?? []

      // Belong to this period by plan/work year.
      const inPeriod =
        (plan && activeYears.includes(plan.planYear)) ||
        (work && activeYears.includes(work.financialYear))

      if (!inPeriod) continue

      // All payments attached to this work (may be recorded in a later FY).
      const displayVouchers = [...allVouchers].sort((a, b) =>
        b.voucherDate.localeCompare(a.voucherDate),
      )
      const spentInr = displayVouchers.reduce((s, v) => s + (v.amountInr || 0), 0)
      const approvedInr =
        plan?.estimatedCostInr != null
          ? plan.estimatedCostInr
          : work?.adminApprovedCostInr != null
            ? work.adminApprovedCostInr
            : null

      let status: ActivityStatus
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
  }, [planByCode, workByCode, vouchersByCode, activeYears])

  /** Activity codes approved / completed in the selected FY(s). */
  const periodActivityCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const p of planByCode.values()) {
      if (activeYears.includes(p.planYear)) codes.add(p.activityCode)
    }
    for (const w of workByCode.values()) {
      if (activeYears.includes(w.financialYear)) codes.add(w.activityCode)
    }
    return codes
  }, [planByCode, workByCode, activeYears])

  const unlinked = useMemo(() => {
    return vouchers
      .filter((v) => activeYears.includes(v.financialYear))
      .filter((v) => !v.workCode || !allWorkCodes.has(v.workCode))
      .sort((a, b) => b.voucherDate.localeCompare(a.voucherDate))
  }, [vouchers, activeYears, allWorkCodes])

  const filteredActivities = useMemo(() => {
    if (filter === 'unlinked') return []
    let rows = activities
    if (filter === 'not_done') rows = rows.filter((a) => a.status === 'not_done')
    if (filter === 'done') rows = rows.filter((a) => a.status === 'done')
    if (filter === 'unpaid') rows = rows.filter((a) => a.status === 'unpaid')
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      rows = rows.filter((a) =>
        `${a.title} ${a.code} ${a.scheme} ${a.sector}`.toLowerCase().includes(needle),
      )
    }
    return rows
  }, [activities, filter, q])

  /** Vouchers recorded in the selected FY(s) — cash-out by payment year. */
  const vouchersForSpend = useMemo(() => {
    return vouchers
      .filter((v) => activeYears.includes(v.financialYear))
      .sort((a, b) => (b.amountInr || 0) - (a.amountInr || 0))
  }, [vouchers, activeYears])

  /** Payments attached to approved/completed works of the selected FY(s), any payment year. */
  const vouchersForWorks = useMemo(() => {
    return vouchers
      .filter((v) => v.workCode && periodActivityCodes.has(v.workCode))
      .sort((a, b) => (b.amountInr || 0) - (a.amountInr || 0))
  }, [vouchers, periodActivityCodes])

  const kpis = useMemo(() => {
    const planInPeriod = [...planByCode.values()].filter((p) =>
      activeYears.includes(p.planYear),
    )
    const workInPeriod = [...workByCode.values()].filter((w) =>
      activeYears.includes(w.financialYear),
    )
    const workCodes = allWorkCodes
    const totalSpend = vouchersForSpend.reduce((s, v) => s + (v.amountInr || 0), 0)
    const linkedSpend = vouchersForSpend
      .filter((v) => v.workCode && workCodes.has(v.workCode))
      .reduce((s, v) => s + (v.amountInr || 0), 0)
    const workSpend = vouchersForWorks.reduce((s, v) => s + (v.amountInr || 0), 0)
    const completedCodes = new Set(workInPeriod.map((w) => w.activityCode))
    const notDone = planInPeriod.filter((p) => !workByCode.has(p.activityCode)).length

    return {
      approved: planInPeriod.reduce((s, p) => s + (p.estimatedCostInr || 0), 0),
      totalSpend,
      linkedSpend,
      workSpend,
      workVoucherCount: vouchersForWorks.length,
      completed: completedCodes.size,
      notDone,
      count: planInPeriod.length,
      voucherCount: vouchersForSpend.length,
    }
  }, [
    planByCode,
    workByCode,
    vouchersForSpend,
    vouchersForWorks,
    activeYears,
    allWorkCodes,
  ])

  const planFilesInPeriod = useMemo(
    () =>
      plans
        .filter((f) => activeYears.includes(f.planYear))
        .sort((a, b) => b.planYear.localeCompare(a.planYear)),
    [plans, activeYears],
  )

  useEffect(() => {
    if (planFilesInPeriod.length === 0) {
      setDocYear(null)
      return
    }
    setDocYear((prev) => {
      if (prev && planFilesInPeriod.some((f) => f.planYear === prev)) return prev
      if (!isRangeView) {
        return planFilesInPeriod.find((f) => f.planYear === year)?.planYear ?? planFilesInPeriod[0].planYear
      }
      return planFilesInPeriod[0].planYear
    })
  }, [planFilesInPeriod, isRangeView, year])

  const activeDoc =
    planFilesInPeriod.find((f) => f.planYear === docYear) ?? planFilesInPeriod[0] ?? null

  const pdfUrl = activeDoc?.pdfPath ? publicAssetUrl(activeDoc.pdfPath) : null
  const sheetViewUrl = activeDoc?.htmlPath
    ? publicAssetUrl(activeDoc.htmlPath)
    : activeDoc?.xlsPath
      ? publicAssetUrl(activeDoc.xlsPath)
      : null
  const sheetDownloadUrl = activeDoc?.xlsPath ? publicAssetUrl(activeDoc.xlsPath) : null

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const unlinkedSum = unlinked.reduce((s, v) => s + (v.amountInr || 0), 0)

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const setView = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'activities') setSearchParams({}, { replace: true })
    else setSearchParams({ view: mode }, { replace: true })
  }

  const statusLabel = (status: ActivityStatus) => {
    if (status === 'done') return t('works.statusDone')
    if (status === 'unpaid') return t('works.statusUnpaid')
    return t('works.statusNotDone')
  }

  const voucherLinkLabel = (info: VoucherLinkInfo) => {
    if (info.kind === 'linked_same_fy') return t('works.voucherLinked')
    if (info.kind === 'linked_other_fy') {
      return t('works.voucherLinkedOtherFy', { year: info.workYear })
    }
    if (info.kind === 'plan_only') {
      return t('works.voucherPlanOnly', { year: info.planYear })
    }
    return t('works.voucherUnlinked')
  }

  const workPaymentLinkLabel = (v: Voucher, info: VoucherLinkInfo) => {
    const workYear = info.workYear || info.planYear
    if (workYear && v.financialYear !== workYear) {
      return t('works.voucherPaidInFy', { year: v.financialYear })
    }
    return t('works.voucherLinked')
  }

  const voucherLinkRowClass = (kind: VoucherLinkKind) => {
    if (kind === 'unlinked') return 'voucher-row-unlinked'
    if (kind === 'plan_only') return 'voucher-row-plan-only'
    return undefined
  }

  const renderVoucherTable = (
    rows: Voucher[],
    total: number,
    linkMode: 'payment_year' | 'work_year',
  ) => {
    if (rows.length === 0) return <EmptyState title={t('common.empty')} />
    return (
      <div className="table-scroll">
        <table className="data-table-dense">
          <thead>
            <tr>
              <th>{t('vouchers.voucherNo')}</th>
              <th>{t('vouchers.date')}</th>
              <th>{t('common.amountInr')}</th>
              <th>{t('vouchers.workCode')}</th>
              <th>{t('vouchers.majorHead')}</th>
              <th>{t('vouchers.objectHead')}</th>
              <th>FY</th>
              <th>{t('works.voucherLinkCol')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const info = resolveVoucherLink(v, workByCode, planByCode)
              const linkText =
                linkMode === 'work_year'
                  ? workPaymentLinkLabel(v, info)
                  : voucherLinkLabel(info)
              return (
                <tr
                  key={v.vId}
                  className={
                    linkMode === 'payment_year' ? voucherLinkRowClass(info.kind) : undefined
                  }
                  title={
                    linkMode === 'payment_year'
                      ? info.kind === 'linked_other_fy'
                        ? t('works.voucherLinkedOtherFyTitle', {
                            year: info.workYear,
                            name: info.workName,
                          })
                        : info.kind === 'plan_only'
                          ? t('works.voucherPlanOnlyTitle', { year: info.planYear })
                          : info.kind === 'unlinked'
                            ? t('vouchers.unlinkedTitle')
                            : undefined
                      : info.workYear && v.financialYear !== info.workYear
                        ? t('works.voucherPaidInFyTitle', {
                            payYear: v.financialYear,
                            workYear: info.workYear,
                            name: info.workName,
                          })
                        : undefined
                  }
                >
                  <td>{v.voucherNo}</td>
                  <td>{v.voucherDate}</td>
                  <td className="cell-strong">{formatInr(v.amountInr, locale)}</td>
                  <td>{v.workCode ?? '—'}</td>
                  <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
                  <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
                  <td>{v.financialYear}</td>
                  <td>{linkText}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="cell-strong" colSpan={2}>
                {t('vouchers.totalRow')}
              </td>
              <td className="cell-strong">{formatInr(total, locale)}</td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <p className="lede">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page page-unified-works">
      <div className="plans-view-tabs" aria-label={t('nav.planWorksShort')}>
        <div className="plans-view-tabs-main" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'activities'}
            className={
              viewMode === 'activities' ? 'section-subnav-link active' : 'section-subnav-link'
            }
            onClick={() => setView('activities')}
          >
            {t('works.tabActivities')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'vouchers'}
            className={
              viewMode === 'vouchers' ? 'section-subnav-link active' : 'section-subnav-link'
            }
            onClick={() => setView('vouchers')}
          >
            {t('works.tabVouchers')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'work_payments'}
            className={
              viewMode === 'work_payments' ? 'section-subnav-link active' : 'section-subnav-link'
            }
            onClick={() => setView('work_payments')}
          >
            {t('works.tabWorkPayments')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'pdf'}
            className={viewMode === 'pdf' ? 'section-subnav-link active' : 'section-subnav-link'}
            onClick={() => setView('pdf')}
          >
            {t('works.tabPlanPdf')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'sheet'}
            className={viewMode === 'sheet' ? 'section-subnav-link active' : 'section-subnav-link'}
            onClick={() => setView('sheet')}
          >
            {t('works.tabPlanSheet')}
          </button>
        </div>
        {(viewMode === 'pdf' || viewMode === 'sheet') && activeDoc ? (
          <div className="plans-view-tabs-actions">
            {viewMode === 'pdf' && pdfUrl ? (
              <a className="btn-secondary btn-compact" href={pdfUrl} target="_blank" rel="noreferrer">
                {t('works.openPdfNewTab')}
              </a>
            ) : null}
            {viewMode === 'sheet' && sheetViewUrl ? (
              <a
                className="btn-secondary btn-compact"
                href={sheetViewUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('works.openSheetNewTab')}
              </a>
            ) : null}
            {viewMode === 'sheet' && sheetDownloadUrl ? (
              <a className="btn-secondary btn-compact" href={sheetDownloadUrl} download>
                {t('works.downloadXls')}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {viewMode === 'pdf' || viewMode === 'sheet' ? (
        <section className="plan-pdf-panel" aria-label={t('works.officialDocs')}>
          {planFilesInPeriod.length > 1 ? (
            <div className="year-chip-row" role="list" aria-label={t('works.officialDocs')}>
              {planFilesInPeriod.map((f) => (
                <button
                  key={f.planYear}
                  type="button"
                  role="listitem"
                  className={f.planYear === activeDoc?.planYear ? 'year-chip active' : 'year-chip'}
                  onClick={() => setDocYear(f.planYear)}
                >
                  {f.planYear}
                </button>
              ))}
            </div>
          ) : activeDoc ? (
            <p className="panel-help">
              {t('works.officialDocsYear', { year: activeDoc.planYear })}
            </p>
          ) : null}

          {!activeDoc ? (
            <EmptyState title={t('works.noPlanForPeriod')} />
          ) : viewMode === 'pdf' ? (
            pdfUrl ? (
              <iframe
                className="plan-pdf-frame"
                title={t('works.planPdfTitle', { year: activeDoc.planYear })}
                src={pdfUrl}
              />
            ) : (
              <EmptyState title={t('works.noPdfForPeriod')} />
            )
          ) : sheetViewUrl ? (
            <iframe
              className="plan-pdf-frame plan-sheet-frame"
              title={t('works.planSheetTitle', { year: activeDoc.planYear })}
              src={sheetViewUrl}
            />
          ) : (
            <EmptyState title={t('works.noSheetForPeriod')} />
          )}
        </section>
      ) : viewMode === 'vouchers' ? (
        <section className="panel" aria-label={t('works.tabVouchers')}>
          <div className="panel-header-row">
            <h2>{t('works.tabVouchers')}</h2>
            <span className="home-muted-total">
              {formatNumber(kpis.voucherCount, locale)} · {formatInr(kpis.totalSpend, locale)}
            </span>
          </div>
          <p className="panel-help">
            {t('works.vouchersTabHelp', {
              linked: formatInr(kpis.linkedSpend, locale),
              total: formatInr(kpis.totalSpend, locale),
            })}
          </p>
          <p className="panel-help">{t('works.vouchersLinkLegend')}</p>
          {renderVoucherTable(vouchersForSpend, kpis.totalSpend, 'payment_year')}
        </section>
      ) : viewMode === 'work_payments' ? (
        <section className="panel" aria-label={t('works.tabWorkPayments')}>
          <div className="panel-header-row">
            <h2>{t('works.tabWorkPayments')}</h2>
            <span className="home-muted-total">
              {formatNumber(kpis.workVoucherCount, locale)} · {formatInr(kpis.workSpend, locale)}
            </span>
          </div>
          <p className="panel-help">
            {t('works.workPaymentsTabHelp', {
              total: formatInr(kpis.workSpend, locale),
              count: formatNumber(kpis.workVoucherCount, locale),
            })}
          </p>
          {renderVoucherTable(vouchersForWorks, kpis.workSpend, 'work_year')}
        </section>
      ) : (
        <>
      <section className="kpi-grid kpi-grid-five" aria-label={t('works.unifiedKpiAria')}>
        <article className="kpi-card kpi-accent">
          <p className="kpi-label">{t('works.kpiApproved')}</p>
          <p className="kpi-value">{formatInrCompact(kpis.approved)}</p>
          <p className="kpi-hint">
            {t('works.kpiApprovedHint', { count: formatNumber(kpis.count, locale) })}
          </p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">{t('works.kpiSpent')}</p>
          <p className="kpi-value">{formatInrCompact(kpis.totalSpend)}</p>
          <p className="kpi-hint">
            {t('works.kpiSpentSplit', {
              linked: formatInrCompact(kpis.linkedSpend),
              total: formatInrCompact(kpis.totalSpend),
            })}
          </p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">{t('works.kpiWorkSpend')}</p>
          <p className="kpi-value">{formatInrCompact(kpis.workSpend)}</p>
          <p className="kpi-hint">{t('works.kpiWorkSpendHint')}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">{t('works.kpiCompleted')}</p>
          <p className="kpi-value">{formatNumber(kpis.completed, locale)}</p>
          <p className="kpi-hint">{t('works.completedWorksHint')}</p>
        </article>
        <article className="kpi-card kpi-muted">
          <p className="kpi-label">{t('works.kpiNotDone')}</p>
          <p className="kpi-value">{formatNumber(kpis.notDone, locale)}</p>
          <p className="kpi-hint">{t('works.kpiNotDoneHint')}</p>
        </article>
      </section>

      <div className="activity-toolbar">
        <div className="activity-filter-chips" role="group" aria-label={t('works.filterAria')}>
          {(
            [
              ['all', t('works.filterAll')],
              ['not_done', t('works.filterNotDone')],
              ['unpaid', t('works.filterUnpaid')],
              ['done', t('works.filterDone')],
              ['unlinked', t('works.filterUnlinked')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'year-chip active' : 'year-chip'}
              onClick={() => setFilter(id)}
            >
              {label}
              {id === 'unlinked' ? ` (${unlinked.length})` : null}
            </button>
          ))}
        </div>
        {filter !== 'unlinked' ? (
          <label className="activity-search">
            <span className="visually-hidden">{t('common.search')}</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('works.searchPlaceholder')}
            />
          </label>
        ) : null}
      </div>

      <p className="works-period-summary" role="status">
        {t('works.unifiedSummary', {
          period: periodLabel,
          shown: formatNumber(
            filter === 'unlinked' ? unlinked.length : filteredActivities.length,
            locale,
          ),
        })}
      </p>

      {filter === 'unlinked' ? (
        <section className="panel work-unlinked-panel" aria-label={t('works.unlinkedSection')}>
          <div className="panel-header-row">
            <h2>{t('works.unlinkedSection')}</h2>
            <span className="home-muted-total">
              {formatNumber(unlinked.length, locale)} · {formatInr(unlinkedSum, locale)}
            </span>
          </div>
          <p className="panel-help">{t('works.unlinkedHelp')}</p>
          {unlinked.length === 0 ? (
            <EmptyState title={t('common.empty')} />
          ) : (
            <VoucherMiniTable rows={unlinked} locale={locale} unlinked />
          )}
        </section>
      ) : filteredActivities.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <section className="card-list activity-card-list" aria-label={t('works.activityListAria')}>
          {filteredActivities.map((a) => {
            const open = expanded.has(a.code)
            const pct = spendRatio(a.approvedInr, a.spentInr)
            return (
              <article
                key={a.code}
                className={`work-card activity-card activity-card-${a.status}`}
              >
                <header className="activity-card-header">
                  <div className="activity-card-title-row">
                    <StatusGlyph status={a.status} label={statusLabel(a.status)} />
                    <div>
                      <h3>{a.title}</h3>
                      {a.description ? (
                        <p className="activity-card-desc">{a.description}</p>
                      ) : null}
                      <p className="activity-card-meta">
                        {a.code}
                        {a.scheme !== '—' ? ` · ${a.scheme}` : ''}
                        {a.sector !== '—' ? ` · ${a.sector}` : ''}
                        {a.outsidePlan ? ` · ${t('works.outsidePlanNote')}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`activity-status-pill activity-status-pill-${a.status}`}>
                    {statusLabel(a.status)}
                  </span>
                </header>

                <dl className="activity-figures">
                  <div>
                    <dt>{t('works.figApproved')}</dt>
                    <dd>
                      {a.approvedInr != null ? formatInr(a.approvedInr, locale) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('works.figSpent')}</dt>
                    <dd>
                      {a.vouchers.length > 0 ? formatInr(a.spentInr, locale) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('works.figShare')}</dt>
                    <dd>{pct != null && a.vouchers.length > 0 ? `${pct}%` : '—'}</dd>
                  </div>
                </dl>

                {a.vouchers.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary btn-compact activity-expand-btn"
                      aria-expanded={open}
                      onClick={() => toggleExpand(a.code)}
                    >
                      {open
                        ? t('works.hideVouchers')
                        : t('works.showVouchers', {
                            count: formatNumber(a.vouchers.length, locale),
                          })}
                    </button>
                    {open ? <VoucherMiniTable rows={a.vouchers} locale={locale} /> : null}
                  </>
                ) : a.status === 'unpaid' ? (
                  <p className="help work-no-vouchers">{t('works.noLink')}</p>
                ) : a.status === 'not_done' ? (
                  <p className="help work-no-vouchers">{t('works.notCompletedHelp')}</p>
                ) : null}
              </article>
            )
          })}
        </section>
      )}

      {filter !== 'unlinked' && unlinked.length > 0 ? (
        <section className="panel work-unlinked-panel" aria-label={t('works.unlinkedSection')}>
          <div className="panel-header-row">
            <h2>{t('works.unlinkedSection')}</h2>
            <button
              type="button"
              className="text-link"
              onClick={() => setFilter('unlinked')}
            >
              {t('works.viewUnlinked', {
                count: formatNumber(unlinked.length, locale),
              })}
            </button>
          </div>
          <p className="panel-help">{t('works.unlinkedHelp')}</p>
        </section>
      ) : null}
        </>
      )}
    </div>
  )
}
