import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadAllVouchers, loadAllWorks } from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import type { SchemeRollup, Voucher, WorkActivity, PlannedActivity } from '../lib/types'

function rollupSchemesForYears(
  vouchers: Voucher[],
  works: WorkActivity[],
  planned: PlannedActivity[],
  activeYears: string[],
): SchemeRollup[] {
  type Acc = SchemeRollup
  const map = new Map<string, Acc>()

  const ensure = (name: string): Acc => {
    let row = map.get(name)
    if (!row) {
      row = {
        schemeName: name,
        financialYears: [],
        recordedPaymentInr: 0,
        plannedOutlayInr: 0,
        completedWorksCount: 0,
        plannedActivitiesCount: 0,
      }
      map.set(name, row)
    }
    return row
  }

  const addYear = (row: Acc, fy: string) => {
    if (!row.financialYears.includes(fy)) row.financialYears.push(fy)
  }

  for (const v of vouchers) {
    if (!activeYears.includes(v.financialYear)) continue
    if (v.voucherKind && v.voucherKind !== 'payment') continue
    const name = v.schemeHint || 'Unspecified / from voucher prefix'
    const row = ensure(name)
    addYear(row, v.financialYear)
    row.recordedPaymentInr += v.amountInr || 0
  }

  for (const w of works) {
    if (!activeYears.includes(w.financialYear)) continue
    const name = w.schemeName || 'Unspecified'
    const row = ensure(name)
    addYear(row, w.financialYear)
    row.completedWorksCount += 1
  }

  for (const a of planned) {
    if (!activeYears.includes(a.planYear)) continue
    const name = a.schemeName || 'Unspecified'
    const row = ensure(name)
    addYear(row, a.planYear)
    row.plannedActivitiesCount += 1
    row.plannedOutlayInr = (row.plannedOutlayInr || 0) + (a.estimatedCostInr || 0)
  }

  return [...map.values()]
    .map((s) => ({
      ...s,
      financialYears: [...s.financialYears].sort(),
    }))
    .sort((a, b) => (b.recordedPaymentInr || 0) - (a.recordedPaymentInr || 0))
}

export function SchemesPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [works, setWorks] = useState<WorkActivity[]>([])
  const [planned, setPlanned] = useState<PlannedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    setLoading(true)
    Promise.all([loadAllVouchers(fys), loadAllWorks(fys), loadAllPlans(fys)])
      .then(([v, w, plans]) => {
        if (cancelled) return
        setVouchers(v)
        setWorks(w)
        setPlanned(plans.flatMap((f) => f.records || []))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meta])

  const schemes = useMemo(
    () => rollupSchemesForYears(vouchers, works, planned, activeYears),
    [vouchers, works, planned, activeYears],
  )

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year

  if (loading) {
    return (
      <div className="page">
        <p className="lede">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>{t('schemes.title')}</h1>
      <p className="lede">{t('schemes.intro')}</p>
      <p className="works-period-summary" role="status">
        {t('schemes.periodSummary', {
          period: periodLabel,
          count: formatNumber(schemes.length, locale),
        })}
      </p>
      <SourceBadge
        source="Derived from vouchers + physical progress + approved plan"
        quality="derived"
        updated={meta?.lastDataUpdate}
      />

      {schemes.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <div className="card-list">
          {schemes.map((s) => (
            <article key={s.schemeName} className="work-card">
              <h2>{s.schemeName}</h2>
              <p className="help">{s.financialYears.join(', ')}</p>
              <dl className="detail-grid">
                <div>
                  <dt>{t('schemes.payments')}</dt>
                  <dd>{formatInr(s.recordedPaymentInr, locale)}</dd>
                </div>
                <div>
                  <dt>{t('schemes.planned')}</dt>
                  <dd>{formatInr(s.plannedOutlayInr ?? null, locale)}</dd>
                </div>
                <div>
                  <dt>{t('schemes.worksCount')}</dt>
                  <dd>{formatNumber(s.completedWorksCount, locale)}</dd>
                </div>
                <div>
                  <dt>{t('schemes.plannedCount')}</dt>
                  <dd>{formatNumber(s.plannedActivitiesCount, locale)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
