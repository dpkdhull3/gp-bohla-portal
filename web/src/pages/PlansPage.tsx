import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadPlanIndex, publicAssetUrl } from '../lib/data'
import { formatInr, formatInrCompact, formatNumber } from '../lib/format'
import type { PlanIndex, PlanYearFile, PlannedActivity } from '../lib/types'

type ViewTab = 'details' | 'pdf' | 'sheet'

function spendRatio(approved: number, spent: number): number {
  if (!approved || approved <= 0) return 0
  return Math.min(100, Math.round((spent / approved) * 100))
}

function groupByScheme(rows: PlannedActivity[]): Array<{ scheme: string; items: PlannedActivity[] }> {
  const map = new Map<string, PlannedActivity[]>()
  for (const row of rows) {
    const key = row.schemeName?.trim() || '—'
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([scheme, items]) => ({
      scheme,
      items: [...items].sort((a, b) => (b.estimatedCostInr || 0) - (a.estimatedCostInr || 0)),
    }))
    .sort((a, b) => {
      const ta = a.items.reduce((s, i) => s + (i.estimatedCostInr || 0), 0)
      const tb = b.items.reduce((s, i) => s + (i.estimatedCostInr || 0), 0)
      return tb - ta
    })
}

export function PlansPage() {
  const { t, i18n } = useTranslation()
  const {
    meta,
    activeYears,
    isRangeView,
    year,
    rangeStart,
    rangeEnd,
    selectSingleYear,
    resetToDefaultRange,
  } = useYear()
  const [planFiles, setPlanFiles] = useState<PlanYearFile[]>([])
  const [planIndex, setPlanIndex] = useState<PlanIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewTab, setViewTab] = useState<ViewTab>('details')
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadPlanIndex()
      .catch(() => ({ years: [] as string[], plans: [] }))
      .then((index) => {
        const years =
          index.years?.length ? index.years : (meta?.availableFinancialYears ?? [])
        return loadAllPlans(years).then((files) => ({ index, files }))
      })
      .then(({ index, files }) => {
        if (cancelled) return
        setPlanIndex(index)
        setPlanFiles(files)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meta])

  const filteredFiles = useMemo(
    () =>
      planFiles
        .filter((f) => activeYears.includes(f.planYear))
        .sort((a, b) => b.planYear.localeCompare(a.planYear)),
    [planFiles, activeYears],
  )

  const filtered = useMemo(
    () => filteredFiles.flatMap((f) => f.records),
    [filteredFiles],
  )

  const totals = useMemo(() => {
    const approved = filtered.reduce((s, a) => s + (a.estimatedCostInr || 0), 0)
    const linked = filtered.reduce(
      (s, a) => s + (a.spendStatus === 'linked' ? a.linkedVoucherSumInr || 0 : 0),
      0,
    )
    const linkedCount = filtered.filter((a) => a.spendStatus === 'linked').length
    return {
      approved,
      linked,
      linkedCount,
      unlinkedCount: filtered.length - linkedCount,
      count: filtered.length,
    }
  }, [filtered])

  const yearRows = useMemo(
    () =>
      filteredFiles.map((f) => ({
        planYear: f.planYear,
        approved: f.totalEstimatedCostInr || 0,
        linked: f.linkedPaymentInr || 0,
        count: f.count,
        linkedCount: f.linkedActivityCount || 0,
      })),
    [filteredFiles],
  )

  const byScheme = useMemo(() => groupByScheme(filtered), [filtered])

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const availablePlanYears = useMemo(
    () =>
      [...new Set([...(planIndex?.years ?? []), ...planFiles.map((f) => f.planYear)])]
        .sort()
        .reverse(),
    [planIndex, planFiles],
  )

  // Use the main period tabs only — pick the newest year in the active filter for PDF/sheet.
  const activeDoc = useMemo(() => {
    if (filteredFiles.length === 0) return null
    if (!isRangeView) {
      return filteredFiles.find((f) => f.planYear === year) ?? filteredFiles[0]
    }
    return filteredFiles[0]
  }, [filteredFiles, isRangeView, year])

  const pdfUrl = activeDoc?.pdfPath ? publicAssetUrl(activeDoc.pdfPath) : null
  const sheetViewUrl = activeDoc?.htmlPath
    ? publicAssetUrl(activeDoc.htmlPath)
    : activeDoc?.xlsPath
      ? publicAssetUrl(activeDoc.xlsPath)
      : null
  const sheetDownloadUrl = activeDoc?.xlsPath ? publicAssetUrl(activeDoc.xlsPath) : null
  const linkageNote = i18n.language === 'hi' ? planIndex?.noteHi : planIndex?.noteEn

  return (
    <div className="page">
      <div className="plans-view-tabs" aria-label={t('works.plannedPageTitle')}>
        <div className="plans-view-tabs-main" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'details'}
            className={viewTab === 'details' ? 'section-subnav-link active' : 'section-subnav-link'}
            onClick={() => setViewTab('details')}
          >
            {t('works.tabPlanDetails')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'pdf'}
            className={viewTab === 'pdf' ? 'section-subnav-link active' : 'section-subnav-link'}
            onClick={() => setViewTab('pdf')}
          >
            {t('works.tabPlanPdf')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'sheet'}
            className={viewTab === 'sheet' ? 'section-subnav-link active' : 'section-subnav-link'}
            onClick={() => setViewTab('sheet')}
          >
            {t('works.tabPlanSheet')}
          </button>
        </div>
        {(viewTab === 'pdf' || viewTab === 'sheet') && activeDoc ? (
          <div className="plans-view-tabs-actions">
            {viewTab === 'pdf' && pdfUrl ? (
              <a className="btn-secondary btn-compact" href={pdfUrl} target="_blank" rel="noreferrer">
                {t('works.openPdfNewTab')}
              </a>
            ) : null}
            {viewTab === 'sheet' && sheetViewUrl ? (
              <a
                className="btn-secondary btn-compact"
                href={sheetViewUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('works.openSheetNewTab')}
              </a>
            ) : null}
            {viewTab === 'sheet' && sheetDownloadUrl ? (
              <a className="btn-secondary btn-compact" href={sheetDownloadUrl} download>
                {t('works.downloadXls')}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="error-text">{t('common.error')}</p> : null}
      {loading ? <p className="lede">{t('common.loading')}</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="empty-state" role="status">
          <strong>{t('works.noPlanForPeriod')}</strong>
          <p>
            {availablePlanYears.length
              ? t('works.noPlanForPeriodBody', {
                  period: periodLabel,
                  available: availablePlanYears.join(', '),
                })
              : t('works.noPlanImported')}
          </p>
          {availablePlanYears.length ? (
            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              {availablePlanYears.map((fy) => (
                <button
                  key={fy}
                  type="button"
                  className="btn-primary btn-compact"
                  onClick={() => selectSingleYear(fy)}
                >
                  {t('works.openPlanYear', { year: fy })}
                </button>
              ))}
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => resetToDefaultRange()}
              >
                {t('nav.periodRangeShort')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewTab === 'details' ? (
        <>
          <section className="plan-kpi-grid" aria-label={t('works.spendCompareAria')}>
            <article className="plan-kpi plan-kpi-approved">
              <p className="plan-summary-label">{t('works.approvedAmount')}</p>
              <p className="plan-summary-value">{formatInrCompact(totals.approved)}</p>
              <p className="plan-kpi-hint">
                {formatNumber(totals.count, locale)} {t('works.activitiesWord')} · {periodLabel}
              </p>
            </article>
            <article className="plan-kpi plan-kpi-spent">
              <p className="plan-summary-label">{t('works.linkedSpent')}</p>
              <p className="plan-summary-value">{formatInrCompact(totals.linked)}</p>
              <p className="plan-kpi-hint">
                {t('works.linkedSpentHint', {
                  count: formatNumber(totals.linkedCount, locale),
                })}
              </p>
            </article>
            <article className="plan-kpi">
              <p className="plan-summary-label">{t('works.unlinkedItems')}</p>
              <p className="plan-summary-value">{formatNumber(totals.unlinkedCount, locale)}</p>
              <p className="plan-kpi-hint">{t('works.unlinkedItemsHint')}</p>
            </article>
          </section>

          {linkageNote ? <p className="help plan-linkage-note">{linkageNote}</p> : null}

          <section className="panel">
            <div className="panel-header-row">
              <h2>{t('works.yearCompareTitle')}</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table-dense">
                <thead>
                  <tr>
                    <th>{t('common.financialYear')}</th>
                    <th>{t('works.approvedAmount')}</th>
                    <th>{t('works.linkedSpent')}</th>
                    <th>{t('works.compareShare')}</th>
                    <th>{t('works.linkedItemsShort')}</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map((row) => {
                    const pct = spendRatio(row.approved, row.linked)
                    return (
                      <tr key={row.planYear}>
                        <td className="cell-strong">{row.planYear}</td>
                        <td className="cell-strong">{formatInr(row.approved, locale)}</td>
                        <td className="cell-strong">
                          {row.linkedCount > 0 ? formatInr(row.linked, locale) : '—'}
                        </td>
                        <td>
                          <div className="spend-bar" aria-label={`${pct}%`}>
                            <span className="spend-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="spend-bar-label">
                            {row.linkedCount > 0 ? `${pct}%` : t('works.noLinkShort')}
                          </span>
                        </td>
                        <td>
                          {formatNumber(row.linkedCount, locale)} /{' '}
                          {formatNumber(row.count, locale)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="cell-strong">{t('works.totalRow')}</td>
                    <td className="cell-strong">{formatInr(totals.approved, locale)}</td>
                    <td className="cell-strong">
                      {totals.linkedCount > 0 ? formatInr(totals.linked, locale) : '—'}
                    </td>
                    <td colSpan={2} className="cell-strong">
                      {totals.linkedCount > 0
                        ? `${spendRatio(totals.approved, totals.linked)}%`
                        : t('works.noLinkShort')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {byScheme.map((group) => {
            const groupApproved = group.items.reduce((s, i) => s + (i.estimatedCostInr || 0), 0)
            const groupLinked = group.items.reduce(
              (s, i) => s + (i.spendStatus === 'linked' ? i.linkedVoucherSumInr || 0 : 0),
              0,
            )
            return (
              <section key={group.scheme} className="plan-scheme-block">
                <div className="plan-scheme-header">
                  <h2>{group.scheme}</h2>
                  <span>
                    {t('works.schemeHeaderSpend', {
                      approved: formatInrCompact(groupApproved),
                      spent:
                        group.items.some((i) => i.spendStatus === 'linked')
                          ? formatInrCompact(groupLinked)
                          : '—',
                    })}
                  </span>
                </div>
                <div className="card-list">
                  {group.items.map((a) => {
                    const approved = a.estimatedCostInr || 0
                    const spent = a.spendStatus === 'linked' ? a.linkedVoucherSumInr || 0 : null
                    const pct = spent === null ? 0 : spendRatio(approved, spent)
                    return (
                      <article
                        key={`${a.planYear}-${a.activityCode}`}
                        className="work-card plan-activity-card"
                      >
                        <header>
                          <h3>{a.activityName}</h3>
                          <span className="pill pill-official">{a.planYear}</span>
                        </header>
                        {a.activityDescription &&
                        a.activityDescription !== a.activityName ? (
                          <p className="plan-activity-desc">{a.activityDescription}</p>
                        ) : null}

                        <div className="plan-compare-row">
                          <div>
                            <p className="plan-summary-label">{t('works.approvedAmount')}</p>
                            <p className="plan-compare-value">{formatInr(approved, locale)}</p>
                          </div>
                          <div>
                            <p className="plan-summary-label">{t('works.linkedSpent')}</p>
                            <p className="plan-compare-value">
                              {spent === null ? '—' : formatInr(spent, locale)}
                            </p>
                          </div>
                        </div>

                        <div className="spend-bar spend-bar-lg" aria-hidden={spent === null}>
                          <span
                            className={
                              spent === null ? 'spend-bar-fill muted' : 'spend-bar-fill'
                            }
                            style={{ width: spent === null ? '0%' : `${pct}%` }}
                          />
                        </div>
                        <p className="plan-kpi-hint">
                          {spent === null
                            ? t('works.itemNoPaymentLink')
                            : t('works.itemSpendShare', {
                                pct,
                                vouchers: formatNumber(a.linkedVoucherCount || 0, locale),
                              })}
                        </p>

                        <dl className="detail-grid">
                          <div>
                            <dt>{t('works.activityCode')}</dt>
                            <dd>{a.activityCode}</dd>
                          </div>
                          {a.sector ? (
                            <div>
                              <dt>{t('works.sector')}</dt>
                              <dd>{a.sector}</dd>
                            </div>
                          ) : null}
                          {a.themeName ? (
                            <div>
                              <dt>{t('works.theme')}</dt>
                              <dd>{a.themeName}</dd>
                            </div>
                          ) : null}
                          {a.locationOfAsset || a.activityLocation ? (
                            <div>
                              <dt>{t('works.location')}</dt>
                              <dd>{a.locationOfAsset || a.activityLocation}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </>
      ) : null}

      {!loading && filtered.length > 0 && viewTab === 'pdf' ? (
        <div className="plan-pdf-panel">
          {pdfUrl ? (
            <iframe
              className="plan-pdf-frame"
              title={t('works.planPdfTitle', { year: activeDoc?.planYear })}
              src={pdfUrl}
            />
          ) : (
            <div className="empty-state" role="status">
              <strong>{t('works.noPdfForPeriod')}</strong>
            </div>
          )}
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewTab === 'sheet' ? (
        <div className="plan-pdf-panel">
          {sheetViewUrl ? (
            <iframe
              className="plan-pdf-frame plan-sheet-frame"
              title={t('works.planSheetTitle', { year: activeDoc?.planYear })}
              src={sheetViewUrl}
            />
          ) : (
            <div className="empty-state" role="status">
              <strong>{t('works.noSheetForPeriod')}</strong>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
