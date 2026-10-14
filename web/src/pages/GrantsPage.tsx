import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { VoucherMiniTable } from '../components/VoucherMiniTable'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadAllVouchers, loadAllWorks, publicAssetUrl } from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import {
  buildGrantActivities,
  indexByActivityCode,
  type GrantStatus,
} from '../lib/grantActivities'
import type { PlanYearFile, PlannedActivity, Voucher, WorkActivity } from '../lib/types'

type DocView = 'list' | 'pdf' | 'sheet'

function docFromSearch(raw: string | null): DocView {
  if (raw === 'pdf' || raw === 'docs') return 'pdf'
  if (raw === 'sheet') return 'sheet'
  return 'list'
}

export function GrantsPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [searchParams, setSearchParams] = useSearchParams()
  const [works, setWorks] = useState<WorkActivity[]>([])
  const [plans, setPlans] = useState<PlanYearFile[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [docView, setDocView] = useState<DocView>(() => docFromSearch(searchParams.get('view')))
  const [docYear, setDocYear] = useState<string | null>(null)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    setDocView(docFromSearch(searchParams.get('view')))
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

  const workByCode = useMemo(() => indexByActivityCode(works), [works])
  const planByCode = useMemo(() => {
    const map = new Map<string, PlannedActivity>()
    for (const file of plans) {
      for (const a of file.records || []) {
        if (!map.has(a.activityCode)) map.set(a.activityCode, a)
      }
    }
    return map
  }, [plans])

  const grants = useMemo(
    () =>
      buildGrantActivities(planByCode, workByCode, vouchers, activeYears).filter(
        (g) => (g.approvedInr ?? 0) > 0,
      ),
    [planByCode, workByCode, vouchers, activeYears],
  )

  const filtered = useMemo(() => {
    if (!q.trim()) return grants
    const needle = q.trim().toLowerCase()
    return grants.filter((g) =>
      `${g.title} ${g.description ?? ''} ${g.code} ${g.scheme} ${g.sector}`
        .toLowerCase()
        .includes(needle),
    )
  }, [grants, q])

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
        return (
          planFilesInPeriod.find((f) => f.planYear === year)?.planYear ??
          planFilesInPeriod[0].planYear
        )
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

  const setView = (mode: DocView) => {
    setDocView(mode)
    if (mode === 'list') setSearchParams({}, { replace: true })
    else setSearchParams({ view: mode }, { replace: true })
  }

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const statusLabel = (status: GrantStatus) => {
    if (status === 'done') return t('works.statusDone')
    if (status === 'unpaid') return t('works.statusUnpaid')
    return t('works.statusNotDone')
  }

  if (loading) {
    return (
      <div className="page">
        <p className="lede">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page page-grants">
      <div className="grants-page-header">
        <div>
          <h1>{t('grants.title')}</h1>
          <p className="lede">{t('grants.intro')}</p>
        </div>
        <div className="grants-doc-actions" role="group" aria-label={t('works.officialDocs')}>
          <button
            type="button"
            className={docView === 'list' ? 'year-chip active' : 'year-chip'}
            onClick={() => setView('list')}
          >
            {t('grants.tabList')}
          </button>
          <button
            type="button"
            className={docView === 'pdf' ? 'year-chip active' : 'year-chip'}
            onClick={() => setView('pdf')}
          >
            {t('works.tabPlanPdf')}
          </button>
          <button
            type="button"
            className={docView === 'sheet' ? 'year-chip active' : 'year-chip'}
            onClick={() => setView('sheet')}
          >
            {t('works.tabPlanSheet')}
          </button>
        </div>
      </div>

      {docView === 'pdf' || docView === 'sheet' ? (
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

          {(docView === 'pdf' && pdfUrl) || (docView === 'sheet' && sheetViewUrl) ? (
            <div className="plans-view-tabs-actions grants-doc-open">
              {docView === 'pdf' && pdfUrl ? (
                <a className="btn-secondary btn-compact" href={pdfUrl} target="_blank" rel="noreferrer">
                  {t('works.openPdfNewTab')}
                </a>
              ) : null}
              {docView === 'sheet' && sheetViewUrl ? (
                <a
                  className="btn-secondary btn-compact"
                  href={sheetViewUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('works.openSheetNewTab')}
                </a>
              ) : null}
              {docView === 'sheet' && sheetDownloadUrl ? (
                <a className="btn-secondary btn-compact" href={sheetDownloadUrl} download>
                  {t('works.downloadXls')}
                </a>
              ) : null}
            </div>
          ) : null}

          {!activeDoc ? (
            <EmptyState title={t('works.noPlanForPeriod')} />
          ) : docView === 'pdf' ? (
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
      ) : (
        <>
          <div className="activity-toolbar">
            <p className="works-period-summary" role="status">
              {t('grants.summary', {
                period: periodLabel,
                count: formatNumber(filtered.length, locale),
              })}
            </p>
            <label className="activity-search">
              <span className="visually-hidden">{t('common.search')}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('grants.searchPlaceholder')}
              />
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t('common.empty')} />
          ) : (
            <ul className="grant-list" aria-label={t('grants.listAria')}>
              {filtered.map((g) => {
                const open = expanded.has(g.code)
                const paymentCount = g.vouchers.length
                const fy = g.planYear || g.workYear
                return (
                  <li key={g.code} className={`grant-list-item grant-list-item-${g.status}`}>
                    <div className="grant-list-row">
                      <Link
                        to={`/grants/${g.code}`}
                        className="grant-list-main grant-list-link"
                        aria-label={`${t('grants.viewDetails')}: ${g.title}`}
                      >
                        <div className="grant-list-topline">
                          {g.activityNo != null ? (
                            <span className="grant-list-badge">
                              {t('grants.activityNo', { n: g.activityNo })}
                            </span>
                          ) : null}
                          {fy ? <span className="grant-list-fy">{fy}</span> : null}
                        </div>
                        <p className="grant-list-headline">{g.title}</p>
                        {g.description ? (
                          <p className="grant-list-desc">{g.description}</p>
                        ) : null}
                        <p className="grant-list-meta">
                          {g.code}
                          {g.scheme !== '—' ? ` · ${g.scheme}` : ''}
                        </p>
                      </Link>
                      <div className="grant-list-side">
                        <p className="grant-list-amount">
                          {g.approvedInr != null ? formatInr(g.approvedInr, locale) : '—'}
                        </p>
                        <span className={`grant-list-status grant-list-status-${g.status}`}>
                          {statusLabel(g.status)}
                        </span>
                        {paymentCount > 0 ? (
                          <button
                            type="button"
                            className="text-link grant-list-payments"
                            aria-expanded={open}
                            onClick={() => toggleExpand(g.code)}
                          >
                            {open
                              ? t('grants.hidePayments')
                              : t('grants.showPayments', {
                                  count: formatNumber(paymentCount, locale),
                                })}
                          </button>
                        ) : (
                          <span className="grant-list-payments-none">
                            {t('grants.noPayments')}
                          </span>
                        )}
                      </div>
                    </div>
                    {open && paymentCount > 0 ? (
                      <div className="grant-list-vouchers">
                        <VoucherMiniTable rows={g.vouchers} locale={locale} />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
