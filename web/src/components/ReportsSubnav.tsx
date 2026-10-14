import { useTranslation } from 'react-i18next'
import { SectionSubnav } from './SectionSubnav'

export function ReportsSubnav() {
  const { t } = useTranslation()
  return (
    <SectionSubnav
      ariaLabel={t('nav.reports')}
      links={[
        { to: '/reports', label: t('reports.tabOverview'), end: true },
        { to: '/reports/downloads', label: t('reports.tabDownloads') },
        { to: '/reports/audit', label: t('reports.tabAudit') },
        { to: '/reports/about', label: t('reports.tabAbout') },
      ]}
    />
  )
}
