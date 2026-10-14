import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadVoucherDetail, voucherDetailUrl } from '../lib/data'
import { formatInr } from '../lib/format'
import type { Voucher, VoucherDetail } from '../lib/types'

export function VoucherDetailPanel({
  voucher,
  locale,
}: {
  voucher: Voucher
  locale: string
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<VoucherDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const egUrl = voucher.detailUrl || voucherDetailUrl(voucher.financialYear, voucher.vId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadVoucherDetail(voucher.financialYear, voucher.vId).then((d) => {
      if (!cancelled) {
        setDetail(d)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [voucher.financialYear, voucher.vId])

  const payee = detail?.payments?.[0]?.payeeName
  const mode = detail?.payments?.[0]?.modeOfPayment
  const accountNo = detail?.payments?.[0]?.accountNoMasked
  const amount =
    detail?.amountInr != null
      ? formatInr(detail.amountInr, locale)
      : formatInr(voucher.amountInr, locale)

  return (
    <div className="voucher-detail-panel">
      {loading ? (
        <p className="voucher-detail-loading">{t('common.loading')}</p>
      ) : (
        <dl className="voucher-detail-grid">
          {detail?.schemeName ? (
            <>
              <dt>{t('vouchers.detailScheme')}</dt>
              <dd>{detail.schemeName}</dd>
            </>
          ) : null}
          {detail?.activityCode || detail?.activityLabel ? (
            <>
              <dt>{t('vouchers.detailActivity')}</dt>
              <dd>
                {detail.activityCode ? `${detail.activityCode}` : ''}
                {detail.activityLabel
                  ? `${detail.activityCode ? ' · ' : ''}${detail.activityLabel}`
                  : ''}
              </dd>
            </>
          ) : null}
          {detail?.particulars ? (
            <>
              <dt>{t('vouchers.detailParticulars')}</dt>
              <dd>{detail.particulars}</dd>
            </>
          ) : null}
          {payee ? (
            <>
              <dt>{t('vouchers.detailPayee')}</dt>
              <dd>{payee}</dd>
            </>
          ) : null}
          {mode ? (
            <>
              <dt>{t('vouchers.detailPaymentMode')}</dt>
              <dd>
                {mode}
                {accountNo ? ` · ${accountNo}` : ''}
              </dd>
            </>
          ) : null}
          <dt>{t('common.amountInr')}</dt>
          <dd className="cell-strong">{amount}</dd>
          {detail?.transactionType ? (
            <>
              <dt>{t('vouchers.detailTxnType')}</dt>
              <dd>{detail.transactionType}</dd>
            </>
          ) : null}
          {detail?.accountHeads && detail.accountHeads.length > 0 ? (
            <>
              <dt>{t('vouchers.detailAccountHeads')}</dt>
              <dd>
                <ul className="voucher-detail-heads">
                  {detail.accountHeads.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {detail?.attachedFile && !detail.attachedFile.includes('nbsp') ? (
            <>
              <dt>{t('vouchers.detailAttachment')}</dt>
              <dd>{detail.attachedFile}</dd>
            </>
          ) : null}
        </dl>
      )}
      {!loading && !detail ? (
        <p className="voucher-detail-missing">{t('vouchers.detailNotImported')}</p>
      ) : null}
      <p className="voucher-receipt-actions">
        <a className="voucher-receipt-link" href={egUrl} target="_blank" rel="noreferrer">
          {t('vouchers.openOnEgram')}
          <span className="voucher-receipt-ext" aria-hidden>
            ↗
          </span>
        </a>
      </p>
    </div>
  )
}
