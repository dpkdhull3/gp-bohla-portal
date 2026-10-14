import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { useYear } from '../context/YearContext'
import { loadAllWorks } from '../lib/data'
import { formatInr } from '../lib/format'
import type { WorkActivity } from '../lib/types'

export function WorksPage() {
  const { t, i18n } = useTranslation()
  const { meta, activeYears } = useYear()
  const [works, setWorks] = useState<WorkActivity[]>([])
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    const fys = meta?.availableFinancialYears ?? []
    void loadAllWorks(fys).then(setWorks)
  }, [meta])

  const filtered = useMemo(
    () => works.filter((w) => activeYears.includes(w.financialYear)),
    [works, activeYears],
  )

  return (
    <div className="page">
      {filtered.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <div className="card-list">
          {filtered.map((w) => (
            <article key={`${w.financialYear}-${w.activityCode}`} className="work-card">
              <header>
                <h2>{w.activityName}</h2>
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
                    {w.linkedVoucherCount
                      ? formatInr(w.linkedVoucherSumInr, locale)
                      : t('works.noLink')}
                  </dd>
                </div>
                <div>
                  <dt>{t('works.completionDate')}</dt>
                  <dd>{w.completionDate ?? '—'}</dd>
                </div>
              </dl>
              <p className="help">
                {t('common.asRecorded')} · {t('common.notVerifiedIndependently')}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
