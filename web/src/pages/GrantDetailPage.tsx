import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { VoucherMiniTable } from '../components/VoucherMiniTable'
import { useYear } from '../context/YearContext'
import {
  loadAllPlans,
  loadAllVouchers,
  loadAllWorks,
  loadPlanActivityRaw,
} from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import {
  buildGrantActivityByCode,
  indexByActivityCode,
  type GrantStatus,
} from '../lib/grantActivities'
import type { PlanActivityRaw, PlannedActivity, Voucher, WorkActivity } from '../lib/types'

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value).trim() || '—'
}

function Fact({ label, value }: { label: string; value: string }) {
  if (value === '—') return null
  return (
    <div className="gd-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function GrantDetailPage() {
  const { activityCode = '' } = useParams<{ activityCode: string }>()
  const { t, i18n } = useTranslation()
  const { meta } = useYear()
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  const [works, setWorks] = useState<WorkActivity[]>([])
  const [plans, setPlans] = useState<PlannedActivity[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [raw, setRaw] = useState<PlanActivityRaw | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    setLoading(true)
    Promise.all([loadAllWorks(fys), loadAllPlans(fys), loadAllVouchers(fys)])
      .then(([w, planFiles, v]) => {
        if (cancelled) return
        setWorks(w)
        setPlans(planFiles.flatMap((f) => f.records || []))
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
  const planByCode = useMemo(() => indexByActivityCode(plans), [plans])

  const grant = useMemo(() => {
    if (!activityCode) return null
    return buildGrantActivityByCode(activityCode, planByCode, workByCode, vouchers)
  }, [activityCode, planByCode, workByCode, vouchers])

  useEffect(() => {
    let cancelled = false
    const planYear = grant?.plan?.planYear || grant?.workYear
    if (!grant || !planYear) {
      setRaw(null)
      return
    }
    loadPlanActivityRaw(planYear, grant.code).then((detail) => {
      if (!cancelled) setRaw(detail)
    })
    return () => {
      cancelled = true
    }
  }, [grant])

  const statusLabel = (status: GrantStatus) => {
    if (status === 'done') return t('works.statusDone')
    if (status === 'unpaid') return t('works.statusUnpaid')
    return t('works.statusNotDone')
  }

  const spendLabel = (spendStatus?: string | null) => {
    if (!spendStatus) return '—'
    if (spendStatus === 'linked') return t('grants.spendLinked')
    if (spendStatus === 'no_linked_payment') return t('grants.spendUnlinked')
    return spendStatus
  }

  if (loading) {
    return (
      <div className="page">
        <p className="lede">{t('common.loading')}</p>
      </div>
    )
  }

  if (!grant) {
    return (
      <div className="page page-grant-detail">
        <Link to="/grants" className="gd-back">
          {t('grants.backToList')}
        </Link>
        <EmptyState title={t('grants.detailNotFound')} />
      </div>
    )
  }

  const plan = grant.plan
  const work = grant.work
  const allocations = raw?.fundAllocation?.filter(Boolean) ?? []
  const headline = grant.description || grant.title
  const category = grant.description ? grant.title : null
  const location = display(plan?.activityLocation || plan?.locationOfAsset || raw?.location)
  const officialStatus = display(plan?.activityStts || raw?.activityStts)
  const remaining =
    grant.approvedInr != null ? Math.max(0, grant.approvedInr - grant.spentInr) : null
  const spendPct =
    grant.approvedInr != null && grant.approvedInr > 0
      ? Math.min(100, Math.round((grant.spentInr / grant.approvedInr) * 100))
      : 0

  return (
    <div className="page page-grant-detail">
      <Link to="/grants" className="gd-back">
        {t('grants.backToList')}
      </Link>

      <header className="gd-hero">
        <div className="gd-hero-top">
          {grant.activityNo != null ? (
            <span className="gd-chip gd-chip-activity">
              {t('grants.activityNo', { n: grant.activityNo })}
            </span>
          ) : null}
          <span className={`gd-status gd-status-${grant.status}`}>
            {statusLabel(grant.status)}
          </span>
          {officialStatus !== '—' ? (
            <span className="gd-chip gd-chip-soft">{officialStatus}</span>
          ) : null}
          {grant.outsidePlan ? (
            <span className="gd-chip">{t('works.outsidePlanNote')}</span>
          ) : null}
        </div>

        {category ? <p className="gd-kicker">{category}</p> : null}
        <h1 className="gd-title">{headline}</h1>

        <div className="gd-meta-row">
          {grant.activityNo != null ? (
            <span className="gd-meta-item">
              <span className="gd-meta-label">{t('grants.fieldActivityNo')}</span>
              {t('grants.activityNoShort', { n: grant.activityNo })}
            </span>
          ) : null}
          <span className="gd-meta-item">
            <span className="gd-meta-label">{t('grants.fieldCode')}</span>
            {grant.code}
          </span>
          {grant.scheme !== '—' ? (
            <span className="gd-meta-item">
              <span className="gd-meta-label">{t('grants.fieldScheme')}</span>
              {grant.scheme}
            </span>
          ) : null}
          {grant.sector !== '—' ? (
            <span className="gd-meta-item">
              <span className="gd-meta-label">{t('grants.fieldSector')}</span>
              {grant.sector}
            </span>
          ) : null}
          {(grant.planYear || grant.workYear) && (
            <span className="gd-meta-item">
              <span className="gd-meta-label">{t('common.financialYear')}</span>
              {grant.planYear || grant.workYear}
            </span>
          )}
        </div>
      </header>

      <section className="gd-metrics" aria-label={t('grants.detailSummaryAria')}>
        <article className="gd-metric">
          <p className="gd-metric-label">{t('works.figApproved')}</p>
          <p className="gd-metric-value">
            {grant.approvedInr != null ? formatInr(grant.approvedInr, locale) : '—'}
          </p>
        </article>
        <article className="gd-metric">
          <p className="gd-metric-label">{t('works.figSpent')}</p>
          <p className="gd-metric-value">{formatInr(grant.spentInr, locale)}</p>
          {grant.approvedInr != null ? (
            <div className="gd-spend-bar" aria-hidden="true">
              <span style={{ width: `${spendPct}%` }} />
            </div>
          ) : null}
        </article>
        <article className="gd-metric">
          <p className="gd-metric-label">{t('grants.paymentCount')}</p>
          <p className="gd-metric-value">{formatNumber(grant.vouchers.length, locale)}</p>
          {remaining != null ? (
            <p className="gd-metric-hint">
              {t('grants.remaining', { amount: formatInr(remaining, locale) })}
            </p>
          ) : null}
        </article>
      </section>

      <div className="gd-grid">
        <section className="gd-panel" aria-labelledby="gd-about-heading">
          <h2 id="gd-about-heading">{t('grants.sectionAbout')}</h2>
          <dl className="gd-facts">
            <Fact label={t('grants.fieldTheme')} value={display(plan?.themeName || raw?.themeName)} />
            <Fact label={t('grants.fieldActivityType')} value={display(plan?.activityType || raw?.activityType)} />
            <Fact label={t('grants.fieldLocation')} value={location} />
            <Fact label={t('grants.fieldWorkType')} value={display(raw?.workTyp)} />
            <Fact label={t('grants.fieldOutputType')} value={display(raw?.outputTyp)} />
            <Fact label={t('grants.fieldSpendStatus')} value={spendLabel(plan?.spendStatus)} />
          </dl>
        </section>

        <section className="gd-panel" aria-labelledby="gd-money-heading">
          <h2 id="gd-money-heading">{t('grants.sectionMoney')}</h2>
          {allocations.length > 0 ? (
            <ul className="gd-alloc-list">
              {allocations.map((a, idx) => (
                <li key={`${a.schemeCode}-${a.componentCode}-${idx}`} className="gd-alloc-item">
                  <div>
                    <p className="gd-alloc-scheme">{display(a.schemeCode)}</p>
                    <p className="gd-alloc-component">{display(a.componentCode)}</p>
                  </div>
                  <p className="gd-alloc-amount">
                    {a.amountTotal != null ? formatInr(a.amountTotal, locale) : '—'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <dl className="gd-facts">
              <Fact
                label={t('grants.fieldEstimatedCost')}
                value={
                  plan?.estimatedCostInr != null
                    ? formatInr(plan.estimatedCostInr, locale)
                    : '—'
                }
              />
              <Fact
                label={t('grants.fieldGeneralFund')}
                value={
                  plan?.generalFundInr != null ? formatInr(plan.generalFundInr, locale) : '—'
                }
              />
              <Fact
                label={t('grants.fieldScFund')}
                value={plan?.scFundInr != null ? formatInr(plan.scFundInr, locale) : '—'}
              />
              <Fact
                label={t('grants.fieldStFund')}
                value={plan?.stFundInr != null ? formatInr(plan.stFundInr, locale) : '—'}
              />
            </dl>
          )}
        </section>
      </div>

      <section className="gd-panel" aria-labelledby="gd-progress-heading">
        <h2 id="gd-progress-heading">{t('grants.sectionWork')}</h2>
        {work ? (
          <dl className="gd-facts gd-facts-wide">
            <Fact label={t('grants.fieldCompletionDate')} value={display(work.completionDate)} />
            <Fact
              label={t('grants.fieldAdminApproved')}
              value={
                work.adminApprovedCostInr != null
                  ? formatInr(work.adminApprovedCostInr, locale)
                  : '—'
              }
            />
            <Fact label={t('grants.fieldComponent')} value={display(work.componentName)} />
            <Fact label={t('grants.fieldWorkYear')} value={display(work.financialYear)} />
          </dl>
        ) : (
          <p className="gd-empty-note">{t('works.notCompletedHelp')}</p>
        )}
      </section>

      <section className="gd-panel" aria-labelledby="gd-payments-heading">
        <div className="gd-panel-head">
          <h2 id="gd-payments-heading">{t('grants.sectionPayments')}</h2>
          {grant.vouchers.length > 0 ? (
            <span className="gd-chip gd-chip-soft">
              {t('grants.showPayments', {
                count: formatNumber(grant.vouchers.length, locale),
              })}
            </span>
          ) : null}
        </div>
        {grant.vouchers.length > 0 ? (
          <VoucherMiniTable rows={grant.vouchers} locale={locale} />
        ) : (
          <p className="gd-empty-note">{t('grants.noPayments')}</p>
        )}
      </section>

      {(raw || plan) && (
        <section className="gd-panel gd-panel-muted">
          <button
            type="button"
            className="gd-more-toggle"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? t('grants.hideTechnical') : t('grants.showTechnical')}
          </button>
          {showMore ? (
            <dl className="gd-facts gd-facts-wide gd-more-body">
              <Fact label={t('grants.fieldActivityName')} value={display(plan?.activityName)} />
              <Fact
                label={t('grants.fieldDescription')}
                value={display(plan?.activityDescription)}
              />
              <Fact label={t('grants.fieldAssetCategory')} value={display(raw?.astCatNm)} />
              <Fact
                label={t('grants.fieldAssetSubCategory')}
                value={display(raw?.astSubCatNm)}
              />
              <Fact
                label={t('grants.fieldAssetUnits')}
                value={
                  raw?.astNumOfUnt != null ? formatNumber(raw.astNumOfUnt, locale) : '—'
                }
              />
              <Fact
                label={t('grants.fieldUnitCost')}
                value={raw?.astUnitCost != null ? formatInr(raw.astUnitCost, locale) : '—'}
              />
              <Fact label={t('grants.fieldPanchayat')} value={display(raw?.plnUntNm)} />
              <Fact label={t('grants.fieldState')} value={display(raw?.stateName)} />
            </dl>
          ) : null}
        </section>
      )}

      {(plan?.source?.sourceUrl || work?.source?.sourceUrl) && (
        <p className="gd-source">
          {t('common.source')}:{' '}
          {plan?.source?.sourceUrl ? (
            <a href={plan.source.sourceUrl} target="_blank" rel="noreferrer">
              {plan.source.reportName || t('common.viewSource')}
            </a>
          ) : work?.source?.sourceUrl ? (
            <a href={work.source.sourceUrl} target="_blank" rel="noreferrer">
              {t('common.viewSource')}
            </a>
          ) : null}
        </p>
      )}
    </div>
  )
}
