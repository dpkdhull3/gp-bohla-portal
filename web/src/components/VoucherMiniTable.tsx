import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VoucherDetailPanel } from './VoucherDetailPanel'
import { VoucherNoLink } from './VoucherNoLink'
import { formatInr } from '../lib/format'
import type { Voucher } from '../lib/types'

export function VoucherMiniTable({
  rows,
  locale,
  unlinked,
}: {
  rows: Voucher[]
  locale: string
  unlinked?: boolean
}) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<number | null>(null)
  const total = rows.reduce((s, v) => s + (v.amountInr || 0), 0)
  const colCount = unlinked ? 7 : 6

  return (
    <div className="table-scroll work-voucher-table-wrap">
      <table
        className={`data-table-dense work-voucher-table${unlinked ? ' work-voucher-table-unlinked' : ''}`}
      >
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
          {rows.map((v) => {
            const open = openId === v.vId
            return (
              <Fragment key={v.vId}>
                <tr
                  className={unlinked ? 'voucher-row-unlinked' : undefined}
                  title={unlinked ? t('vouchers.unlinkedTitle') : undefined}
                >
                  <td>
                    <VoucherNoLink
                      voucherNo={v.voucherNo}
                      open={open}
                      onToggle={() => setOpenId(open ? null : v.vId)}
                    />
                  </td>
                  <td>{v.voucherDate}</td>
                  <td className="cell-strong">{formatInr(v.amountInr, locale)}</td>
                  <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
                  <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
                  {unlinked ? <td>{v.workCode ?? '—'}</td> : null}
                  <td>{v.financialYear}</td>
                </tr>
                {open ? (
                  <tr className="voucher-detail-row">
                    <td colSpan={colCount}>
                      <VoucherDetailPanel voucher={v} locale={locale} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
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
