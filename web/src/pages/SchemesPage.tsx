import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FundsSubnav } from '../components/FundsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'
import { loadSchemes } from '../lib/data'
import { formatInr, formatNumber } from '../lib/format'
import type { SchemeRollup } from '../lib/types'

export function SchemesPage() {
  const { t, i18n } = useTranslation()
  const { meta } = useYear()
  const [schemes, setSchemes] = useState<SchemeRollup[]>([])
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    void loadSchemes().then((d) => setSchemes(d.records))
  }, [])

  return (
    <div className="page">
      <FundsSubnav />
      <h1>{t('schemes.title')}</h1>
      <p className="lede">{t('schemes.intro')}</p>
      <SourceBadge
        source="Derived from vouchers + physical progress + approved plan"
        quality="derived"
        updated={meta?.lastDataUpdate}
      />

      <div className="card-list">
        {schemes.map((s) => (
          <article key={s.schemeName} className="work-card">
            <h2>{s.schemeName}</h2>
            <p className="help">{s.financialYears.join(', ')}</p>
            <dl className="detail-grid">
              <div>
                <dt>{t('schemes.payments')}</dt>
                <dd>{formatInr(s.recordedPaymentInr, locale)}</dd>
              </div>
              <div>
                <dt>{t('schemes.planned')}</dt>
                <dd>{formatInr(s.plannedOutlayInr ?? null, locale)}</dd>
              </div>
              <div>
                <dt>{t('schemes.worksCount')}</dt>
                <dd>{formatNumber(s.completedWorksCount, locale)}</dd>
              </div>
              <div>
                <dt>{t('schemes.plannedCount')}</dt>
                <dd>{formatNumber(s.plannedActivitiesCount, locale)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
