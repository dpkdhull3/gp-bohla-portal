import { useTranslation } from 'react-i18next'
import { ReportsSubnav } from '../components/ReportsSubnav'
import { useYear } from '../context/YearContext'

export function AboutPage() {
  const { t, i18n } = useTranslation()
  const { meta } = useYear()

  return (
    <div className="page">
      <ReportsSubnav />
      <h1>{t('about.title')}</h1>
      <p className="banner-strong">{t('about.notOfficial')}</p>

      <section className="panel prose">
        <h2>{t('about.where')}</h2>
        <p>{t('about.whereBody')}</p>
        <ul>
          {meta?.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel prose">
        <h2>{t('about.howOften')}</h2>
        <p>{t('about.howOftenBody')}</p>
        <p>
          {t('common.updated')}: {meta?.lastDataUpdate}
        </p>
      </section>

      <section className="panel prose">
        <h2>{t('about.metrics')}</h2>
        <p>{t('about.metricsBody')}</p>
      </section>

      <section className="panel prose">
        <h2>{t('about.missing')}</h2>
        <p>{t('about.missingBody')}</p>
      </section>

      <section className="panel prose">
        <h2>{t('about.reportError')}</h2>
        <p>{t('about.reportErrorBody')}</p>
      </section>

      <section className="panel prose">
        <p>{i18n.language === 'hi' ? meta?.disclaimerHi : meta?.disclaimerEn}</p>
      </section>
    </div>
  )
}
