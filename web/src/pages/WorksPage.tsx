import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { useYear } from '../context/YearContext'
import { loadAllVouchers, loadAllWorks } from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import type { Voucher, WorkActivity } from '../lib/types'

type WorkWithVouchers = {
  work: WorkActivity
  vouchers: Voucher[]
  voucherSum: number
}

function isUnlinkedVoucher(v: Voucher, workCodes: Set<string>): boolean {
  if (!v.workCode) return true
  return !workCodes.has(v.workCode)
}

function VoucherMiniTable({
  rows,
  locale,
  unlinked,
}: {
  rows: Voucher[]
  locale: string
  unlinked?: boolean
}) {
  const { t } = useTranslation()
  const total = rows.reduce((s, v) => s + (v.amountInr || 0), 0)

  return (
    <div className="table-scroll work-voucher-table-wrap">
      <table className={`data-table-dense work-voucher-table${unlinked ? ' work-voucher-table-unlinked' : ''}`}>
        <thead>
          <tr>
            <th>{t('vouchers.voucherNo')}</th>
            <th>{t('vouchers.date')}</th>
            <th>{t('common.amountInr')}</th>
            <th>{t('vouchers.majorHead')}</th>
            <th>{t('vouchers.objectHead')}</th>
            {unlinked ? <th>{t('vouchers.workCode')}</th> : null}
            <th>FY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.vId}
              className={unlinked ? 'voucher-row-unlinked' : undefined}
              title={unlinked ? t('vouchers.unlinkedTitle') : undefined}
            >
              <td>{v.voucherNo}</td>
              <td>{v.voucherDate}</td>
              <td className="cell-strong">{formatInr(v.amountInr, locale)}</td>
              <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
              <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
              {unlinked ? <td>{v.workCode ?? '—'}</td> : null}
              <td>{v.financialYear}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="cell-strong" colSpan={2}>
              {t('vouchers.totalRow')}
            </td>
            <td className="cell-strong">{formatInr(total, locale)}</td>
            <td colSpan={unlinked ? 4 : 3} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function WorksPage() {
  const { t, i18n } = useTranslation()
  const { meta, year, isRangeView, activeYears, rangeStart, rangeEnd } = useYear()
  const [works, setWorks] = useState<WorkActivity[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    let cancelled = false
    const fys = meta?.availableFinancialYears ?? []
    setLoading(true)
    Promise.all([loadAllWorks(fys), loadAllVouchers(fys)])
      .then(([w, v]) => {
        if (cancelled) return
        setWorks(w)
        setVouchers(v)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meta])

  const allWorkCodes = useMemo(
    () => new Set(works.map((w) => w.activityCode)),
    [works],
  )

  const worksByCode = useMemo(() => {
    const map = new Map<string, WorkActivity>()
    for (const w of works) {
      // Prefer keeping first; works are unique per code in practice
      if (!map.has(w.activityCode)) map.set(w.activityCode, w)
    }
    return map
  }, [works])

  const vouchersInPeriod = useMemo(
    () => vouchers.filter((v) => activeYears.includes(v.financialYear)),
    [vouchers, activeYears],
  )

  const { grouped, unlinked } = useMemo(() => {
    const byCode = new Map<string, Voucher[]>()
    const loose: Voucher[] = []

    for (const v of vouchersInPeriod) {
      if (isUnlinkedVoucher(v, allWorkCodes)) {
        loose.push(v)
        continue
      }
      const code = v.workCode as string
      const list = byCode.get(code) ?? []
      list.push(v)
      byCode.set(code, list)
    }

    const groups: WorkWithVouchers[] = []
    const seen = new Set<string>()

    // Works in selected period (with or without vouchers)
    for (const w of works) {
      if (!activeYears.includes(w.financialYear)) continue
      const rows = byCode.get(w.activityCode) ?? []
      groups.push({
        work: w,
        vouchers: [...rows].sort((a, b) => b.voucherDate.localeCompare(a.voucherDate)),
        voucherSum: rows.reduce((s, x) => s + (x.amountInr || 0), 0),
      })
      seen.add(w.activityCode)
    }

    // Vouchers linked to a work outside the selected years — still show the work
    for (const [code, rows] of byCode) {
      if (seen.has(code)) continue
      const work = worksByCode.get(code)
      if (!work) continue
      groups.push({
        work,
        vouchers: [...rows].sort((a, b) => b.voucherDate.localeCompare(a.voucherDate)),
        voucherSum: rows.reduce((s, x) => s + (x.amountInr || 0), 0),
      })
    }

    groups.sort((a, b) => {
      if (b.voucherSum !== a.voucherSum) return b.voucherSum - a.voucherSum
      return a.work.activityName.localeCompare(b.work.activityName)
    })

    loose.sort((a, b) => b.voucherDate.localeCompare(a.voucherDate))

    return { grouped: groups, unlinked: loose }
  }, [works, vouchersInPeriod, activeYears, allWorkCodes, worksByCode])

  const periodLabel = isRangeView ? `${rangeStart} – ${rangeEnd}` : year
  const linkedVoucherCount = grouped.reduce((s, g) => s + g.vouchers.length, 0)
  const linkedVoucherSum = grouped.reduce((s, g) => s + g.voucherSum, 0)
  const unlinkedSum = unlinked.reduce((s, v) => s + (v.amountInr || 0), 0)

  if (loading) {
    return (
      <div className="page">
        <p className="lede">{t('common.loading')}</p>
      </div>
    )
  }

  if (grouped.length === 0 && unlinked.length === 0) {
    return (
      <div className="page">
        <EmptyState title={t('common.empty')} />
      </div>
    )
  }

  return (
    <div className="page">
      <h1>{t('works.mergedTitle')}</h1>
      <p className="lede">{t('works.mergedIntro')}</p>
      <p className="works-period-summary" role="status">
        {t('works.mergedSummary', {
          period: periodLabel,
          works: formatNumber(grouped.length, locale),
          linked: formatNumber(linkedVoucherCount, locale),
          linkedAmount: formatInr(linkedVoucherSum, locale),
          unlinked: formatNumber(unlinked.length, locale),
          unlinkedAmount: formatInr(unlinkedSum, locale),
        })}
      </p>

      {grouped.length > 0 ? (
        <section className="card-list" aria-label={t('works.byWorkSection')}>
          <h2 className="works-section-title">{t('works.byWorkSection')}</h2>
          {grouped.map(({ work: w, vouchers: rows, voucherSum }) => (
            <article key={`${w.financialYear}-${w.activityCode}`} className="work-card">
              <header>
                <h3>{w.activityName}</h3>
                <span className="pill pill-official">{t('works.statusCompleted')}</span>
              </header>
              <dl className="detail-grid">
                <div>
                  <dt>{t('works.activityCode')}</dt>
                  <dd>{w.activityCode}</dd>
                </div>
                <div>
                  <dt>{t('common.financialYear')}</dt>
                  <dd>{w.financialYear}</dd>
                </div>
                <div>
                  <dt>{t('works.scheme')}</dt>
                  <dd>{w.schemeName ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('works.focusArea')}</dt>
                  <dd>{w.focusArea ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('works.approvedCost')}</dt>
                  <dd>{formatInr(w.adminApprovedCostInr, locale)}</dd>
                </div>
                <div>
                  <dt>{t('works.linkedPayments')}</dt>
                  <dd>
                    {rows.length
                      ? `${formatInr(voucherSum, locale)} · ${formatNumber(rows.length, locale)}`
                      : t('works.noLink')}
                  </dd>
                </div>
                <div>
                  <dt>{t('works.completionDate')}</dt>
                  <dd>{w.completionDate ?? '—'}</dd>
                </div>
              </dl>

              {rows.length > 0 ? (
                <>
                  <h4 className="work-vouchers-heading">{t('works.vouchersForWork')}</h4>
                  <VoucherMiniTable rows={rows} locale={locale} />
                </>
              ) : (
                <p className="help work-no-vouchers">{t('works.noLink')}</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {unlinked.length > 0 ? (
        <section className="panel work-unlinked-panel" aria-label={t('works.unlinkedSection')}>
          <div className="panel-header-row">
            <h2>{t('works.unlinkedSection')}</h2>
            <span className="home-muted-total">
              {formatNumber(unlinked.length, locale)} · {formatInr(unlinkedSum, locale)}
            </span>
          </div>
          <p className="panel-help">{t('works.unlinkedHelp')}</p>
          <VoucherMiniTable rows={unlinked} locale={locale} unlinked />
        </section>
      ) : null}
    </div>
  )
}
