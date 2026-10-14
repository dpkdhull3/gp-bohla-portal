import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaymentVoucherTable } from '../components/PaymentVoucherTable'
import { useYear } from '../context/YearContext'
import { loadAllPlans, loadAllVouchers, loadAllWorks } from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import { indexByActivityCode } from '../lib/grantActivities'
import type { PlannedActivity, Voucher, WorkActivity } from '../lib/types'

export function PaymentsPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [works, setWorks] = useState<WorkActivity[]>([])
  const [plans, setPlans] = useState<PlannedActivity[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    setLoading(true)
    Promise.all([loadAllWorks(fys), loadAllPlans(fys), loadAllVouchers(fys)])
      .then(([w, p, v]) => {
        if (cancelled) return
        setWorks(w)
        setPlans(p.flatMap((f) => f.records || []))
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

  const vouchersForPeriod = useMemo(() => {
    return vouchers
      .filter((v) => activeYears.includes(v.financialYear))
      .sort((a, b) => (b.amountInr || 0) - (a.amountInr || 0))
  }, [vouchers, activeYears])

  const total = useMemo(
    () => vouchersForPeriod.reduce((s, v) => s + (v.amountInr || 0), 0),
    [vouchersForPeriod],
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
    <div className="page page-payments">
      <h1>{t('payments.title')}</h1>
      <p className="lede">{t('payments.intro')}</p>
      <p className="works-period-summary" role="status">
        {t('payments.summary', {
          period: periodLabel,
          count: formatNumber(vouchersForPeriod.length, locale),
          total: formatInr(total, locale),
        })}
      </p>
      <ul className="payments-link-legend" aria-label={t('payments.legendAria')}>
        <li>
          <span className="payments-swatch payments-swatch-plan" aria-hidden />
          {t('payments.legendPlanOnly')}
        </li>
        <li>
          <span className="payments-swatch payments-swatch-miss" aria-hidden />
          {t('payments.legendUnlinked')}
        </li>
      </ul>
      <PaymentVoucherTable
        rows={vouchersForPeriod}
        total={total}
        locale={locale}
        workByCode={workByCode}
        planByCode={planByCode}
        linkMode="payment_year"
      />
    </div>
  )
}
