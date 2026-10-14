import { useTranslation } from 'react-i18next'

/** Hyperlink-style control that expands in-page voucher details. */
export function VoucherNoLink({
  voucherNo,
  open,
  onToggle,
}: {
  voucherNo: string
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={`voucher-no-link${open ? ' is-open' : ''}`}
      aria-expanded={open}
      aria-label={t('vouchers.toggleDetailsAria', { no: voucherNo })}
      onClick={onToggle}
    >
      <span className="voucher-no-link-id">{voucherNo}</span>
      <span className="voucher-no-link-hint">
        {open ? t('vouchers.hideMore') : t('vouchers.showMore')}
        <span className="voucher-no-link-chevron" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </span>
    </button>
  )
}
