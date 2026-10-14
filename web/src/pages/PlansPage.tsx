import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadPlanIndex, publicAssetUrl } from '../lib/data'
import { formatInr } from '../lib/format'
import type { PlanYearFile, PlannedActivity } from '../lib/types'

type ViewTab = 'details' | 'pdf'

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
  const [indexYears, setIndexYears] = useState<string[]>([])
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
          index.years?.length
            ? index.years
            : (meta?.availableFinancialYears ?? [])
        return loadAllPlans(years).then((files) => ({ index, files }))
      })
      .then(({ index, files }) => {
        if (cancelled) return
        setIndexYears(
          index.years?.length ? index.years : files.map((f) => f.planYear),
        )
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

  const totalEstimated = useMemo(
    () => filtered.reduce((s, a) => s + (a.estimatedCostInr || 0), 0),
    [filtered],
  )

  const byScheme = useMemo(() => groupByScheme(filtered), [filtered])

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const availablePlanYears = useMemo(
    () => [...new Set([...indexYears, ...planFiles.map((f) => f.planYear)])].sort().reverse(),
    [indexYears, planFiles],
  )

  const pdfCandidates = useMemo(
    () => filteredFiles.filter((f) => Boolean(f.pdfPath)),
    [filteredFiles],
  )

  const [pdfYear, setPdfYear] = useState<string | null>(null)

  useEffect(() => {
    if (pdfCandidates.length === 0) {
      setPdfYear(null)
      return
    }
    setPdfYear((prev) =>
      prev && pdfCandidates.some((f) => f.planYear === prev)
        ? prev
        : pdfCandidates[0].planYear,
    )
  }, [pdfCandidates])

  const activePdf = pdfCandidates.find((f) => f.planYear === pdfYear) ?? pdfCandidates[0]
  const pdfUrl = activePdf?.pdfPath ? publicAssetUrl(activePdf.pdfPath) : null

  return (
    <div className="page">
      <div className="plans-view-tabs" role="tablist" aria-label={t('works.plannedPageTitle')}>
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
          <div className="plan-summary-bar">
            <div>
              <p className="plan-summary-label">{periodLabel}</p>
              <p className="plan-summary-value">
                {t('works.plannedTotal', { count: filtered.length })}
              </p>
            </div>
            <div className="plan-summary-total">
              <p className="plan-summary-label">{t('works.estimatedCost')}</p>
              <p className="plan-summary-value">{formatInr(totalEstimated, locale)}</p>
            </div>
          </div>

          {filteredFiles.length > 1 ? (
            <p className="help">{t('works.planMultiYearHint', { years: filteredFiles.length })}</p>
          ) : null}

          {byScheme.map((group) => {
            const groupTotal = group.items.reduce((s, i) => s + (i.estimatedCostInr || 0), 0)
            return (
              <section key={group.scheme} className="plan-scheme-block">
                <div className="plan-scheme-header">
                  <h2>{group.scheme}</h2>
                  <span>
                    {group.items.length} · {formatInr(groupTotal, locale)}
                  </span>
                </div>
                <div className="card-list">
                  {group.items.map((a) => (
                    <article
                      key={`${a.planYear}-${a.activityCode}`}
                      className="work-card plan-activity-card"
                    >
                      <header>
                        <h3>{a.activityName}</h3>
                        <span className="pill pill-official">{formatInr(a.estimatedCostInr, locale)}</span>
                      </header>
                      {a.activityDescription &&
                      a.activityDescription !== a.activityName ? (
                        <p className="plan-activity-desc">{a.activityDescription}</p>
                      ) : null}
                      <dl className="detail-grid">
                        <div>
                          <dt>{t('common.financialYear')}</dt>
                          <dd>{a.planYear}</dd>
                        </div>
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
                        {a.activityType ? (
                          <div>
                            <dt>{t('works.activityType')}</dt>
                            <dd>{a.activityType}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </>
      ) : null}

      {!loading && filtered.length > 0 && viewTab === 'pdf' ? (
        <div className="plan-pdf-panel">
          {pdfCandidates.length > 1 ? (
            <div className="year-chip-row" role="list" aria-label={t('works.tabPlanPdf')}>
              {pdfCandidates.map((f) => (
                <button
                  key={f.planYear}
                  type="button"
                  role="listitem"
                  className={f.planYear === activePdf?.planYear ? 'year-chip active' : 'year-chip'}
                  onClick={() => setPdfYear(f.planYear)}
                >
                  {f.planYear}
                </button>
              ))}
            </div>
          ) : null}

          {pdfUrl ? (
            <>
              <div className="plan-pdf-actions">
                <a className="btn-secondary btn-compact" href={pdfUrl} target="_blank" rel="noreferrer">
                  {t('works.openPdfNewTab')}
                </a>
                {activePdf?.xlsPath ? (
                  <a
                    className="btn-secondary btn-compact"
                    href={publicAssetUrl(activePdf.xlsPath)}
                    download
                  >
                    {t('works.downloadXls')}
                  </a>
                ) : null}
              </div>
              <iframe
                className="plan-pdf-frame"
                title={t('works.planPdfTitle', { year: activePdf?.planYear })}
                src={pdfUrl}
              />
            </>
          ) : (
            <div className="empty-state" role="status">
              <strong>{t('works.noPdfForPeriod')}</strong>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
