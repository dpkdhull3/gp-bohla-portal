import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'
import { VoucherDetailPanel } from './VoucherDetailPanel'
import { formatInr } from '../lib/format'
import type { PlannedActivity, Voucher, WorkActivity } from '../lib/types'

type VoucherLinkKind = 'linked_same_fy' | 'linked_other_fy' | 'plan_only' | 'unlinked'

type VoucherLinkInfo = {
  kind: VoucherLinkKind
  workYear?: string
  planYear?: string
  workName?: string
}

function resolveVoucherLink(
  v: Voucher,
  workByCode: Map<string, WorkActivity>,
  planByCode: Map<string, PlannedActivity>,
): VoucherLinkInfo {
  const code = v.workCode?.trim()
  if (!code) return { kind: 'unlinked' }
  const work = workByCode.get(code)
  if (work) {
    if (work.financialYear === v.financialYear) {
      return { kind: 'linked_same_fy', workYear: work.financialYear, workName: work.activityName }
    }
    return { kind: 'linked_other_fy', workYear: work.financialYear, workName: work.activityName }
  }
  const plan = planByCode.get(code)
  if (plan) {
    return { kind: 'plan_only', planYear: plan.planYear }
  }
  return { kind: 'unlinked' }
}

export function PaymentVoucherTable({
  rows,
  total,
  locale,
  workByCode,
  planByCode,
  linkMode = 'payment_year',
}: {
  rows: Voucher[]
  total: number
  locale: string
  workByCode: Map<string, WorkActivity>
  planByCode: Map<string, PlannedActivity>
  linkMode?: 'payment_year' | 'work_year'
}) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<number | null>(null)

  const voucherLinkLabel = (info: VoucherLinkInfo) => {
    if (info.kind === 'linked_same_fy') return t('works.voucherLinked')
    if (info.kind === 'linked_other_fy') {
      return t('works.voucherLinkedOtherFy', { year: info.workYear })
    }
    if (info.kind === 'plan_only') {
      return t('works.voucherPlanOnly', { year: info.planYear })
    }
    return t('works.voucherUnlinked')
  }

  const workPaymentLinkLabel = (v: Voucher, info: VoucherLinkInfo) => {
    const workYear = info.workYear || info.planYear
    if (workYear && v.financialYear !== workYear) {
      return t('works.voucherPaidInFy', { year: v.financialYear })
    }
    return t('works.voucherLinked')
  }

  const voucherLinkRowClass = (kind: VoucherLinkKind) => {
    if (kind === 'unlinked') return 'voucher-row-unlinked'
    if (kind === 'plan_only') return 'voucher-row-plan-only'
    return undefined
  }

  if (rows.length === 0) return <EmptyState title={t('common.empty')} />

  const colCount = 8

  return (
    <div className="table-scroll">
      <table className="data-table-dense">
        <thead>
          <tr>
            <th>{t('vouchers.voucherNo')}</th>
            <th>{t('vouchers.date')}</th>
            <th>{t('common.amountInr')}</th>
            <th>{t('vouchers.workCode')}</th>
            <th>{t('vouchers.majorHead')}</th>
            <th>{t('vouchers.objectHead')}</th>
            <th>FY</th>
            <th>{t('works.voucherLinkCol')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const info = resolveVoucherLink(v, workByCode, planByCode)
            const linkText =
              linkMode === 'work_year' ? workPaymentLinkLabel(v, info) : voucherLinkLabel(info)
            const open = openId === v.vId
            return (
              <Fragment key={v.vId}>
                <tr
                  className={linkMode === 'payment_year' ? voucherLinkRowClass(info.kind) : undefined}
                  title={
                    linkMode === 'payment_year'
                      ? info.kind === 'linked_other_fy'
                        ? t('works.voucherLinkedOtherFyTitle', {
                            year: info.workYear,
                            name: info.workName,
                          })
                        : info.kind === 'plan_only'
                          ? t('works.voucherPlanOnlyTitle', { year: info.planYear })
                          : info.kind === 'unlinked'
                            ? t('vouchers.unlinkedTitle')
                            : undefined
                      : info.workYear && v.financialYear !== info.workYear
                        ? t('works.voucherPaidInFyTitle', {
                            payYear: v.financialYear,
                            workYear: info.workYear,
                            name: info.workName,
                          })
                        : undefined
                  }
                >
                  <td>
                    <button
                      type="button"
                      className="text-link voucher-no-toggle"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : v.vId)}
                    >
                      {v.voucherNo}
                    </button>
                  </td>
                  <td>{v.voucherDate}</td>
                  <td className="cell-strong">{formatInr(v.amountInr, locale)}</td>
                  <td>{v.workCode ?? '—'}</td>
                  <td>{v.majorHead?.label || v.majorHead?.raw || '—'}</td>
                  <td>{v.objectHead?.label || v.objectHead?.raw || '—'}</td>
                  <td>{v.financialYear}</td>
                  <td>{linkText}</td>
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
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
