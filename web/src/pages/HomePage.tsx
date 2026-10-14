import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KpiCard } from '../components/KpiCard'
import { useYear } from '../context/YearContext'
import { loadAllWorks } from '../lib/data'
import { formatInr, formatInrCompact, formatNumber } from '../lib/format'
import type { WorkActivity, YearSummary } from '../lib/types'
import { filterYearsInRange } from '../lib/years'

type ChartRow = YearSummary & {
  worksWithLinkedVouchers: number
}

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
    selectSingleYear,
  } = useYear()
  const [works, setWorks] = useState<WorkActivity[]>([])

  useEffect(() => {
    let cancelled = false
    const fys =
      meta?.availableFinancialYears?.length
        ? meta.availableFinancialYears
        : yearSummaries.map((y) => y.financialYear)
    if (fys.length === 0) return
    loadAllWorks(fys)
      .then((w) => {
        if (!cancelled) setWorks(w)
      })
      .catch(() => {
        /* optional */
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

  const linkedByYear = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of works) {
      if (w.linkedVoucherCount > 0) {
        map.set(w.financialYear, (map.get(w.financialYear) ?? 0) + 1)
      }
    }
    return map
  }, [works])

  const chartRows: ChartRow[] = useMemo(
    () =>
      filterYearsInRange(yearSummaries, rangeStart, rangeEnd).map((row) => ({
        ...row,
        worksWithLinkedVouchers: linkedByYear.get(row.financialYear) ?? 0,
      })),
    [yearSummaries, rangeStart, rangeEnd, linkedByYear],
  )

  const rowsWithLinks: ChartRow[] = useMemo(
    () =>
      detailRows.map((row) => ({
        ...row,
        worksWithLinkedVouchers: linkedByYear.get(row.financialYear) ?? 0,
      })),
    [detailRows, linkedByYear],
  )

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year

  const totals = useMemo(
    () => ({
      recordedPaymentInr: rowsWithLinks.reduce((s, y) => s + (y.recordedPaymentInr || 0), 0),
      completedWorksCount: rowsWithLinks.reduce((s, y) => s + (y.completedWorksCount || 0), 0),
      voucherCount: rowsWithLinks.reduce((s, y) => s + (y.voucherCount || 0), 0),
      linkedWorks: rowsWithLinks.reduce((s, y) => s + y.worksWithLinkedVouchers, 0),
    }),
    [rowsWithLinks],
  )

  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'
  const hasData = rowsWithLinks.length > 0

  const openYearWorks = (fy: string) => {
    selectSingleYear(fy)
    void navigate('/works')
  }

  const openYearVouchers = (fy: string) => {
    selectSingleYear(fy)
    void navigate('/funds/vouchers')
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
        <Link className="text-link" to="/funds">
          {t('home.openFunds')}
        </Link>
      </div>

      <section className="kpi-grid kpi-grid-three" aria-label={t('home.summaryAria')}>
        <KpiCard
          label={t('home.recordedPayments')}
          value={hasData ? formatInrCompact(totals.recordedPaymentInr) : '—'}
          hint={
            hasData
              ? `${formatNumber(totals.voucherCount, locale)} ${t('home.voucherCountHint')}`
              : loading
                ? t('common.loading')
                : undefined
          }
          tone="accent"
          to="/funds/vouchers"
        />
        <KpiCard
          label={t('home.completedWorks')}
          value={hasData ? formatNumber(totals.completedWorksCount, locale) : '—'}
          hint={t('common.asRecorded')}
          to="/works"
        />
        <KpiCard
          label={t('home.fundsReceived')}
          value="—"
          hint={t('home.fundsReceivedShort')}
          unavailable
          tone="unavailable"
          to="/reports/about"
        />
      </section>

      {isRangeView ? (
        <section className="panel panel-chart">
          <div className="panel-header-row">
            <h2>{t('home.yearWiseSummaryShort')}</h2>
          </div>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={chartRows}
                role="img"
                aria-label={t('home.yearWiseSummaryShort')}
                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cfd9d4" />
                <XAxis dataKey="financialYear" tick={{ fontSize: 12, fill: '#15262f' }} />
                <YAxis
                  yAxisId="money"
                  tick={{ fontSize: 12, fill: '#15262f' }}
                  width={48}
                  tickFormatter={(v) =>
                    v >= 100000 ? `${Math.round(v / 100000)}L` : `${Math.round(v / 1000)}k`
                  }
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#15262f' }}
                  width={28}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = String(name)
                    if (n === t('home.recordedPayments')) {
                      return [formatInr(Number(value ?? 0), locale), n]
                    }
                    return [formatNumber(Number(value ?? 0), locale), n]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="money"
                  dataKey="recordedPaymentInr"
                  name={t('home.recordedPayments')}
                  fill="#1b3a4b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="completedWorksCount"
                  name={t('home.completedWorks')}
                  stroke="#c45c26"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="voucherCount"
                  name={t('home.voucherCountSeries')}
                  stroke="#2f6b4f"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header-row">
          <h2>{isRangeView ? t('home.yearTableTitleShort') : t('home.yearDetailTitle')}</h2>
          <Link className="text-link" to="/works">
            {t('home.openWorks')}
          </Link>
        </div>
        <div className="table-scroll">
          <table className="data-table-dense">
            <thead>
              <tr>
                <th>{t('common.financialYear')}</th>
                <th>{t('home.recordedPayments')}</th>
                <th>{t('home.voucherCountSeries')}</th>
                <th>{t('home.completedWorks')}</th>
                <th>{t('home.linkedWorks')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rowsWithLinks.map((row) => (
                <tr key={row.financialYear}>
                  <td className="cell-strong">{row.financialYear}</td>
                  <td className="cell-strong">
                    {row.voucherCount > 0 || row.recordedPaymentInr > 0
                      ? formatInr(row.recordedPaymentInr, locale)
                      : '—'}
                  </td>
                  <td className="cell-strong">{formatNumber(row.voucherCount, locale)}</td>
                  <td className="cell-strong">
                    {formatNumber(row.completedWorksCount, locale)}
                  </td>
                  <td className="cell-strong">
                    {formatNumber(row.worksWithLinkedVouchers, locale)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => openYearVouchers(row.financialYear)}
                      >
                        {t('home.openYearVouchers')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => openYearWorks(row.financialYear)}
                      >
                        {t('home.openYearWorks')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
