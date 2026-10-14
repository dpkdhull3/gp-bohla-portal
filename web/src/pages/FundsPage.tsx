import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '../components/EmptyState'
import { FundsSubnav } from '../components/FundsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'
import { loadAllVouchers, loadYearSummaries } from '../lib/data'
import { formatInr } from '../lib/format'
import type { Voucher, YearSummary } from '../lib/types'

const COLORS = ['#1b3a4b', '#2e5a6e', '#c45c26', '#2f6b4f', '#6b5420', '#4a5d68', '#8a4b2e']

export function FundsPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [years, setYears] = useState<YearSummary[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [error, setError] = useState<string | null>(null)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    Promise.all([loadYearSummaries(), loadAllVouchers(fys)])
      .then(([ys, vs]) => {
        if (cancelled) return
        setYears(ys.years)
        setVouchers(vs)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [meta])

  const filtered = useMemo(
    () => vouchers.filter((v) => activeYears.includes(v.financialYear)),
    [vouchers, activeYears],
  )

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const yearRows = useMemo(
    () => years.filter((y) => activeYears.includes(y.financialYear)),
    [years, activeYears],
  )

  const byHead = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of filtered) {
      const key = v.majorHead?.label || v.majorHead?.raw || 'Unknown'
      map.set(key, (map.get(key) ?? 0) + v.amountInr)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const monthly = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of filtered) {
      const key = v.voucherDate.slice(0, 7)
      map.set(key, (map.get(key) ?? 0) + v.amountInr)
    }
    return [...map.entries()]
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  if (error) return <p className="error-text">{t('common.error')}</p>

  return (
    <div className="page">
      <FundsSubnav />
      <h1>{t('funds.title')}</h1>
      <p className="lede">{t('funds.intro')}</p>
      <SourceBadge
        source="eGramSwaraj GP Voucher Details"
        financialYear={periodLabel}
        updated={meta?.lastDataUpdate}
      />

      <section className="panel">
        <h2>{t('funds.yearTable')}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('common.financialYear')}</th>
                <th>{t('home.recordedPayments')}</th>
                <th>Vouchers</th>
                <th>{t('home.completedWorks')}</th>
                <th>{t('home.verifiedBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((y) => (
                <tr key={y.financialYear}>
                  <td>{y.financialYear}</td>
                  <td>{formatInr(y.recordedPaymentInr, locale)}</td>
                  <td>{y.voucherCount}</td>
                  <td>{y.completedWorksCount}</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="help">{t('funds.plannedNote')}</p>
      </section>

      <section className="panel">
        <h2>{t('home.paymentsChart')}</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yearRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cfd9d4" />
              <XAxis dataKey="financialYear" />
              <YAxis width={64} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0), locale)} />
              <Bar dataKey="recordedPaymentInr" fill="#1b3a4b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel two-col">
        <div>
          <h2>{t('funds.byHead')}</h2>
          {byHead.length === 0 ? (
            <EmptyState title={t('common.empty')} />
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byHead} dataKey="value" nameKey="name" outerRadius={100} label={false}>
                    {byHead.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(Number(v ?? 0), locale)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend-list">
                {byHead.map((item, i) => (
                  <li key={item.name}>
                    <span style={{ background: COLORS[i % COLORS.length] }} />
                    {item.name}: {formatInr(item.value, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <h2>{t('funds.monthly')}</h2>
          {monthly.length <= 1 ? (
            <EmptyState title={t('funds.noMonthly')} />
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cfd9d4" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis width={64} />
                  <Tooltip formatter={(v) => formatInr(Number(v ?? 0), locale)} />
                  <Bar dataKey="value" fill="#c45c26" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
