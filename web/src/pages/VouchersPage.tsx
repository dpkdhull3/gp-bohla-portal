import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Papa from 'papaparse'
import { EmptyState } from '../components/EmptyState'
import { FundsSubnav } from '../components/FundsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'
import { loadAllVouchers } from '../lib/data'
import { formatInr } from '../lib/format'
import type { Voucher } from '../lib/types'

export function VouchersPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'date' | 'amount'>('date')
  const [page, setPage] = useState(0)
  const pageSize = 15
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    const fys = meta?.availableFinancialYears ?? []
    void loadAllVouchers(fys).then(setVouchers)
  }, [meta])

  const filtered = useMemo(() => {
    let rows = vouchers.filter((v) => activeYears.includes(v.financialYear))
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((v) =>
        `${v.voucherNo} ${v.workCode ?? ''} ${v.objectHead?.raw ?? ''} ${v.amountInr}`
          .toLowerCase()
          .includes(needle),
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sort === 'amount') return b.amountInr - a.amountInr
      return b.voucherDate.localeCompare(a.voucherDate)
    })
    return rows
  }, [vouchers, activeYears, q, sort])

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const filePeriod = isRangeView ? `${rangeStart}_${rangeEnd}` : year

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize)

  const downloadCsv = () => {
    const csv = Papa.unparse(
      filtered.map((v) => ({
        voucherNo: v.voucherNo,
        voucherDate: v.voucherDate,
        amountInr: v.amountInr,
        workCode: v.workCode ?? '',
        majorHead: v.majorHead?.raw ?? '',
        objectHead: v.objectHead?.raw ?? '',
        financialYear: v.financialYear,
        voucherKind: v.voucherKind,
      })),
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bohla-vouchers-${filePeriod}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <FundsSubnav />
      <h1>{t('vouchers.title')}</h1>
      <SourceBadge
        source="eGramSwaraj GP Voucher Details"
        financialYear={periodLabel}
        updated={meta?.lastDataUpdate}
      />

      <div className="filters">
        <label>
          {t('common.search')}
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'amount')}>
            <option value="date">{t('vouchers.date')}</option>
            <option value="amount">{t('common.amountInr')}</option>
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={downloadCsv}>
          {t('common.downloadCsv')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('vouchers.voucherNo')}</th>
                  <th>{t('vouchers.date')}</th>
                  <th>{t('common.amountInr')}</th>
                  <th>{t('vouchers.workCode')}</th>
                  <th>{t('vouchers.majorHead')}</th>
                  <th>{t('vouchers.objectHead')}</th>
                  <th>FY</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v) => (
                  <tr key={v.vId}>
                    <td>{v.voucherNo}</td>
                    <td>{v.voucherDate}</td>
                    <td>{formatInr(v.amountInr, locale)}</td>
                    <td>{v.workCode ?? '—'}</td>
                    <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
                    <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
                    <td>{v.financialYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ‹
            </button>
            <span>
              {page + 1} / {pageCount} ({filtered.length})
            </span>
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        </>
      )}
    </div>
  )
}
