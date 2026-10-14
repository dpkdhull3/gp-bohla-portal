import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ReportsSubnav } from '../components/ReportsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const { meta } = useYear()

  return (
    <div className="page">
      <ReportsSubnav />
      <h1>{t('reports.title')}</h1>
      <p className="lede">{t('reports.intro')}</p>
      <SourceBadge
        source="eGramSwaraj archived exports + portal methodology"
        updated={meta?.lastDataUpdate}
      />

      <div className="card-list">
        <Link to="/reports/downloads" className="work-card work-card-link">
          <h2>{t('reports.tabDownloads')}</h2>
          <p className="help">{t('downloads.intro')}</p>
        </Link>
        <Link to="/reports/audit" className="work-card work-card-link">
          <h2>{t('reports.tabAudit')}</h2>
          <p className="help">{t('audit.intro')}</p>
        </Link>
        <Link to="/reports/about" className="work-card work-card-link">
          <h2>{t('reports.tabAbout')}</h2>
          <p className="help">{t('about.metricsBody')}</p>
        </Link>
      </div>

      <section className="panel">
        <h2>{t('common.coverage')}</h2>
        <ul className="coverage-list">
          {meta?.coverage.map((c) => (
            <li key={c.metric}>
              <span className={`status-dot status-${c.status}`} />
              <div>
                <strong>{t(`coverage.${c.metric}`, { defaultValue: c.metric })}</strong>
                <p>{i18n.language === 'hi' ? c.noteHi : c.noteEn}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
