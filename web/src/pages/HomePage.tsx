import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KpiCard } from '../components/KpiCard'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadAllVouchers, publicAssetUrl } from '../lib/data'
import { formatInr, formatInrCompact, formatNumber } from '../lib/format'
import type { PlanYearFile, Voucher, YearSummary } from '../lib/types'
import { filterYearsInRange } from '../lib/years'

const SECTOR_COLORS = [
  '#1b3a4b',
  '#2f6b4f',
  '#c45c26',
  '#2e5a6e',
  '#6b5420',
  '#4a5d68',
  '#8a4b2e',
  '#3d6b5a',
]

export function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const {
    meta,
    yearSummaries,
    loading,
    year,
    isRangeView,
    rangeStart,
    rangeEnd,
    activeYears,
    selectSingleYear,
  } = useYear()
  const [plans, setPlans] = useState<PlanYearFile[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])

  useEffect(() => {
    let cancelled = false
    const fys =
      meta?.availableFinancialYears?.length
        ? meta.availableFinancialYears
        : yearSummaries.map((y) => y.financialYear)
    if (fys.length === 0) return
    Promise.all([loadAllPlans(fys), loadAllVouchers(fys)])
      .then(([p, v]) => {
        if (cancelled) return
        setPlans(p)
        setVouchers(v)
      })
      .catch(() => {
        /* optional enrichments */
      })
    return () => {
      cancelled = true
    }
  }, [meta, yearSummaries])

  const detailRows = useMemo(() => {
    if (!yearSummaries.length) return [] as YearSummary[]
    if (!isRangeView) return yearSummaries.filter((y) => y.financialYear === year)
    return filterYearsInRange(yearSummaries, rangeStart, rangeEnd)
  }, [yearSummaries, isRangeView, year, rangeStart, rangeEnd])

  const plansInPeriod = useMemo(
    () => plans.filter((p) => activeYears.includes(p.planYear)),
    [plans, activeYears],
  )

  const vouchersInPeriod = useMemo(
    () => vouchers.filter((v) => activeYears.includes(v.financialYear)),
    [vouchers, activeYears],
  )

  /**
   * Approved-plan KPI must come from year-summaries (written at import from
   * eGramSwaraj curl/API data). Do not wait on async loadAllPlans — that race
   * left the first KPI as "—" while activity hints already appeared.
   */
  const planTotals = useMemo(() => {
    const fromSummaries = {
      approved: detailRows.reduce((s, y) => s + (Number(y.approvedPlanInr) || 0), 0),
      tied: detailRows.reduce((s, y) => s + (Number(y.tiedInr) || 0), 0),
      untied: detailRows.reduce((s, y) => s + (Number(y.untiedInr) || 0), 0),
      activities: detailRows.reduce((s, y) => s + (Number(y.plannedActivityCount) || 0), 0),
      linkedPlanSpend: 0,
    }
    if (fromSummaries.approved > 0 || fromSummaries.activities > 0) {
      return fromSummaries
    }
    // Fallback only if summaries predate this field (old JSON).
    const approved = plansInPeriod.reduce((s, p) => {
      const top = Number(p.totalEstimatedCostInr)
      if (Number.isFinite(top) && top > 0) return s + top
      return (
        s +
        (p.records || []).reduce((a, r) => a + (Number(r.estimatedCostInr) || 0), 0)
      )
    }, 0)
    const tied = plansInPeriod.reduce((s, p) => s + (Number(p.tiedInr) || 0), 0)
    const untied = plansInPeriod.reduce((s, p) => s + (Number(p.untiedInr) || 0), 0)
    const activities = plansInPeriod.reduce((s, p) => s + (Number(p.count) || 0), 0)
    const linkedPlanSpend = plansInPeriod.reduce(
      (s, p) => s + (Number(p.linkedPaymentInr) || 0),
      0,
    )
    return { approved, tied, untied, activities, linkedPlanSpend }
  }, [detailRows, plansInPeriod])

  const yearCompare = useMemo(() => {
    return filterYearsInRange(yearSummaries, rangeStart, rangeEnd).map((row) => {
      const approvedFromSummary = Number(row.approvedPlanInr) || 0
      const planFile = plans.find((p) => p.planYear === row.financialYear)
      const approvedFallback =
        Number(planFile?.totalEstimatedCostInr) ||
        (planFile?.records || []).reduce(
          (a, r) => a + (Number(r.estimatedCostInr) || 0),
          0,
        )
      return {
        financialYear: row.financialYear,
        approvedInr: approvedFromSummary > 0 ? approvedFromSummary : approvedFallback,
        spentInr: row.recordedPaymentInr || 0,
        completedWorksCount: row.completedWorksCount || 0,
        voucherCount: row.voucherCount || 0,
      }
    })
  }, [yearSummaries, rangeStart, rangeEnd, plans])

  const sectorRows = useMemo(() => {
    const map = new Map<string, number>()
    for (const plan of plansInPeriod) {
      if (plan.sectorBreakdown?.length) {
        for (const row of plan.sectorBreakdown) {
          map.set(row.sector, (map.get(row.sector) ?? 0) + row.plannedInr)
        }
      } else {
        for (const a of plan.records || []) {
          const key = (a.sector || '').trim() || '—'
          map.set(key, (map.get(key) ?? 0) + (a.estimatedCostInr || 0))
        }
      }
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [plansInPeriod])

  const spendByHead = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of vouchersInPeriod) {
      const key = v.majorHead?.label || v.majorHead?.raw || '—'
      map.set(key, (map.get(key) ?? 0) + (v.amountInr || 0))
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [vouchersInPeriod])

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year

  const totals = useMemo(
    () => ({
      recordedPaymentInr: detailRows.reduce((s, y) => s + (y.recordedPaymentInr || 0), 0),
      completedWorksCount: detailRows.reduce((s, y) => s + (y.completedWorksCount || 0), 0),
      voucherCount: detailRows.reduce((s, y) => s + (y.voucherCount || 0), 0),
    }),
    [detailRows],
  )

  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'
  const hasData = detailRows.length > 0 || plansInPeriod.length > 0
  const approvedPlanValue =
    planTotals.approved > 0 ? formatInrCompact(planTotals.approved) : '—'
  const tiedShare =
    planTotals.tied + planTotals.untied > 0
      ? Math.round((planTotals.tied / (planTotals.tied + planTotals.untied)) * 100)
      : 0

  const openYearWorks = (fy: string) => {
    selectSingleYear(fy)
    void navigate('/grants')
  }

  const openYearPayments = (fy: string) => {
    selectSingleYear(fy)
    void navigate('/payments')
  }

  const singleYearPlan =
    !isRangeView
      ? plans.find((p) => p.planYear === year) ?? plansInPeriod[0] ?? null
      : null
  const singleYearPdf = singleYearPlan?.pdfPath
    ? publicAssetUrl(singleYearPlan.pdfPath)
    : null
  const singleYearSheet = singleYearPlan?.htmlPath
    ? publicAssetUrl(singleYearPlan.htmlPath)
    : singleYearPlan?.xlsPath
      ? publicAssetUrl(singleYearPlan.xlsPath)
      : null
  const singleYearXls = singleYearPlan?.xlsPath
    ? publicAssetUrl(singleYearPlan.xlsPath)
    : null

  const planDocsForYear = (fy: string) => {
    const file = plans.find((p) => p.planYear === fy)
    if (!file) return { pdf: null as string | null, sheet: null as string | null, xls: null as string | null }
    return {
      pdf: file.pdfPath ? publicAssetUrl(file.pdfPath) : null,
      sheet: file.htmlPath
        ? publicAssetUrl(file.htmlPath)
        : file.xlsPath
          ? publicAssetUrl(file.xlsPath)
          : null,
      xls: file.xlsPath ? publicAssetUrl(file.xlsPath) : null,
    }
  }

  return (
    <div className="page page-home">
      <div className="home-topbar">
        <div>
          <h1 className="home-title">{t('place.villageName')}</h1>
          <p className="home-meta">
            {periodLabel} · eGramSwaraj · {meta?.lastDataUpdate ?? '—'}
          </p>
        </div>
        <div className="home-topbar-links">
          <Link className="text-link" to="/grants">
            {t('home.openPlans')}
          </Link>
          <Link className="text-link" to="/payments">
            {t('home.openPayments')}
          </Link>
        </div>
      </div>

      <section className="kpi-grid kpi-grid-three" aria-label={t('home.summaryAria')}>
        <KpiCard
          label={t('home.approvedPlan')}
          value={loading && !hasData ? t('common.loading') : approvedPlanValue}
          hint={
            planTotals.activities > 0
              ? t('home.approvedPlanHint', {
                  count: formatNumber(planTotals.activities, locale),
                })
              : loading
                ? t('common.loading')
                : undefined
          }
          tone="accent"
          to="/grants"
        />
        <KpiCard
          label={t('home.moneyUsed')}
          value={hasData ? formatInrCompact(totals.recordedPaymentInr) : '—'}
          hint={t('home.moneyUsedHint', {
            count: formatNumber(totals.voucherCount, locale),
          })}
          to="/payments"
        />
        <KpiCard
          label={t('home.completedWorks')}
          value={hasData ? formatNumber(totals.completedWorksCount, locale) : '—'}
          hint={t('home.completedWorksHint')}
          to="/grants"
        />
      </section>

      {!isRangeView ? (
        <section className="panel home-year-docs" aria-label={t('home.yearPlanDocsTitle', { year })}>
          <div className="panel-header-row">
            <h2>{t('home.yearPlanDocsTitle', { year })}</h2>
          </div>
          <p className="panel-help">{t('home.yearPlanDocsHelp')}</p>
          {singleYearPdf || singleYearSheet || singleYearXls ? (
            <div className="home-year-docs-actions">
              {singleYearPdf ? (
                <a
                  className="btn-secondary"
                  href={singleYearPdf}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('home.viewPlanPdf')}
                </a>
              ) : null}
              {singleYearSheet ? (
                <a
                  className="btn-secondary"
                  href={singleYearSheet}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('home.viewPlanSheet')}
                </a>
              ) : null}
              {singleYearXls ? (
                <a className="btn-secondary" href={singleYearXls} download>
                  {t('home.downloadPlanSheet')}
                </a>
              ) : null}
              <Link
                className="btn-secondary"
                to={{ pathname: '/grants', search: '?view=pdf' }}
              >
                {t('home.openPlanViewer')}
              </Link>
            </div>
          ) : (
            <p className="panel-help">{t('home.yearPlanDocsMissing')}</p>
          )}
        </section>
      ) : null}

      {planTotals.tied + planTotals.untied > 0 ? (
        <section className="panel home-split-panel" aria-label={t('home.tiedUntiedSplit')}>
          <div className="panel-header-row">
            <h2>{t('home.tiedUntiedSplit')}</h2>
            <span className="home-muted-total">{formatInr(planTotals.tied + planTotals.untied, locale)}</span>
          </div>
          <div className="home-split-bar" role="img" aria-label={`${tiedShare}% tied`}>
            <span className="home-split-tied" style={{ width: `${tiedShare}%` }} />
            <span className="home-split-untied" style={{ width: `${100 - tiedShare}%` }} />
          </div>
          <div className="home-split-legend">
            <div>
              <strong>{t('home.tiedLabel')}</strong>
              <p>{formatInr(planTotals.tied, locale)}</p>
              <span className="home-split-note">{t('home.tiedHint')}</span>
            </div>
            <div>
              <strong>{t('home.untiedLabel')}</strong>
              <p>{formatInr(planTotals.untied, locale)}</p>
              <span className="home-split-note">{t('home.untiedHint')}</span>
            </div>
          </div>
        </section>
      ) : null}

      {isRangeView && yearCompare.some((r) => r.approvedInr > 0 || r.spentInr > 0) ? (
        <section className="panel panel-chart">
          <div className="panel-header-row">
            <h2>{t('home.yearWiseSummaryShort')}</h2>
          </div>
          <p className="panel-help">{t('home.yearWiseSummaryHelp')}</p>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={yearCompare}
                role="img"
                aria-label={t('home.yearWiseSummaryShort')}
                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cfd9d4" />
                <XAxis dataKey="financialYear" tick={{ fontSize: 12, fill: '#15262f' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#15262f' }}
                  width={48}
                  tickFormatter={(v) =>
                    v >= 100000 ? `${Math.round(v / 100000)}L` : `${Math.round(v / 1000)}k`
                  }
                />
                <Tooltip
                  formatter={(value, name) => [formatInr(Number(value ?? 0), locale), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="approvedInr"
                  name={t('home.approvedSeries')}
                  fill="#1b3a4b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="spentInr"
                  name={t('home.spentSeries')}
                  fill="#c45c26"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {sectorRows.length > 0 || spendByHead.length > 0 ? (
        <div className="home-charts-grid">
          {sectorRows.length > 0 ? (
            <section className="panel panel-chart">
              <div className="panel-header-row">
                <h2>{t('home.sectorChartTitle')}</h2>
              </div>
              <p className="panel-help">{t('home.sectorChartHelp')}</p>
              <div className="chart-wrap chart-wrap-tall home-sector-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={sectorRows}
                      dataKey="value"
                      nameKey="name"
                      cx="42%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {sectorRows.map((_, i) => (
                        <Cell
                          key={sectorRows[i].name}
                          fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatInr(Number(value ?? 0), locale)} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 11, maxWidth: '46%' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          {spendByHead.length > 0 ? (
            <section className="panel panel-chart">
              <div className="panel-header-row">
                <h2>{t('home.spendByHeadTitle')}</h2>
              </div>
              <p className="panel-help">{t('home.spendByHeadHelp')}</p>
              <div className="chart-wrap chart-wrap-tall home-sector-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={spendByHead}
                      dataKey="value"
                      nameKey="name"
                      cx="42%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {spendByHead.map((_, i) => (
                        <Cell
                          key={spendByHead[i].name}
                          fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatInr(Number(value ?? 0), locale)} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 11, maxWidth: '46%' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header-row">
          <h2>{isRangeView ? t('home.yearTableTitleShort') : t('home.yearDetailTitle')}</h2>
          <Link className="text-link" to="/grants">
            {t('home.openWorks')}
          </Link>
        </div>
        <p className="panel-help">{t('home.yearTableHelp')}</p>

        {/* Desktop / wide: table */}
        <div className="table-scroll year-stats-table-wrap">
          <table className="data-table-dense year-stats-table">
            <thead>
              <tr>
                <th>{t('common.financialYear')}</th>
                <th>{t('home.colApproved')}</th>
                <th>{t('home.colMoneyUsed')}</th>
                <th>{t('home.colWorks')}</th>
                <th>{t('home.colVouchers')}</th>
                <th>{t('home.colPlanDocs')}</th>
              </tr>
            </thead>
            <tbody>
              {yearCompare
                .filter((row) => (isRangeView ? true : row.financialYear === year))
                .map((row) => {
                  const docs = planDocsForYear(row.financialYear)
                  return (
                    <tr key={row.financialYear}>
                      <td className="cell-strong">{row.financialYear}</td>
                      <td className="cell-strong">
                        {row.approvedInr > 0 ? formatInr(row.approvedInr, locale) : '—'}
                      </td>
                      <td className="cell-strong">
                        {row.voucherCount > 0 || row.spentInr > 0
                          ? formatInr(row.spentInr, locale)
                          : '—'}
                      </td>
                      <td className="cell-strong">
                        {formatNumber(row.completedWorksCount, locale)}
                      </td>
                      <td className="cell-strong">
                        {formatNumber(row.voucherCount, locale)}
                      </td>
                      <td>
                        <div className="row-actions">
                          {docs.pdf ? (
                            <a
                              className="btn-secondary btn-compact"
                              href={docs.pdf}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('home.planPdfShort', { year: row.financialYear })}
                            </a>
                          ) : null}
                          {docs.xls ? (
                            <a className="btn-secondary btn-compact" href={docs.xls} download>
                              {t('home.planSheetShort', { year: row.financialYear })}
                            </a>
                          ) : docs.sheet ? (
                            <a
                              className="btn-secondary btn-compact"
                              href={docs.sheet}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('home.planSheetShort', { year: row.financialYear })}
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => openYearWorks(row.financialYear)}
                          >
                            {t('home.openYearGrants', { year: row.financialYear })}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => openYearPayments(row.financialYear)}
                          >
                            {t('home.openYearVouchers', { year: row.financialYear })}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked year cards so actions stay visible */}
        <ul className="year-stat-list" aria-label={t('home.yearTableTitleShort')}>
          {yearCompare
            .filter((row) => (isRangeView ? true : row.financialYear === year))
            .map((row) => {
              const docs = planDocsForYear(row.financialYear)
              return (
                <li key={row.financialYear} className="year-stat-card">
                  <div className="year-stat-card-top">
                    <p className="year-stat-fy">{row.financialYear}</p>
                    <div className="year-stat-metrics">
                      <div>
                        <span className="year-stat-label">{t('home.colApproved')}</span>
                        <span className="year-stat-value">
                          {row.approvedInr > 0 ? formatInr(row.approvedInr, locale) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="year-stat-label">{t('home.colMoneyUsed')}</span>
                        <span className="year-stat-value">
                          {row.voucherCount > 0 || row.spentInr > 0
                            ? formatInr(row.spentInr, locale)
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="year-stat-label">{t('home.colWorks')}</span>
                        <span className="year-stat-value">
                          {formatNumber(row.completedWorksCount, locale)}
                        </span>
                      </div>
                      <div>
                        <span className="year-stat-label">{t('home.colVouchers')}</span>
                        <span className="year-stat-value">
                          {formatNumber(row.voucherCount, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="year-stat-actions" role="group" aria-label={t('home.colPlanDocs')}>
                    {docs.pdf ? (
                      <a
                        className="btn-secondary btn-compact"
                        href={docs.pdf}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('home.planPdfShort', { year: row.financialYear })}
                      </a>
                    ) : null}
                    {docs.xls ? (
                      <a className="btn-secondary btn-compact" href={docs.xls} download>
                        {t('home.planSheetShort', { year: row.financialYear })}
                      </a>
                    ) : docs.sheet ? (
                      <a
                        className="btn-secondary btn-compact"
                        href={docs.sheet}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('home.planSheetShort', { year: row.financialYear })}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => openYearWorks(row.financialYear)}
                    >
                      {t('home.openYearGrants', { year: row.financialYear })}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => openYearPayments(row.financialYear)}
                    >
                      {t('home.openYearVouchers', { year: row.financialYear })}
                    </button>
                  </div>
                </li>
              )
            })}
        </ul>
      </section>
    </div>
  )
}
