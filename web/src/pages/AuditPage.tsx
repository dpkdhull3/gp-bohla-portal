import { useTranslation } from 'react-i18next'
import { ReportsSubnav } from '../components/ReportsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'

export function AuditPage() {
  const { t } = useTranslation()
  const { meta } = useYear()

  return (
    <div className="page">
      <ReportsSubnav />
      <h1>{t('audit.title')}</h1>
      <p className="lede">{t('audit.intro')}</p>
      <SourceBadge
        source="Reviewed local reports + AuditOnline catalogue (no Bohla files imported)"
        quality="official"
        updated={meta?.lastDataUpdate}
      />

      <section className="panel audit-panel">
        <p className="status-line">
          <span className="status-dot status-missing" />
          {t('audit.status')}
        </p>
        <p>{t('audit.neutral')}</p>
        <ul className="plain-list">
          <li>No report found in reviewed sources</li>
          <li>Report available — when imported</li>
          <li>Observation recorded — when present in source</li>
          <li>Reply/response recorded — when present in source</li>
          <li>Action pending in the available record</li>
          <li>Resolved according to the available record</li>
        </ul>
      </section>
    </div>
  )
}
