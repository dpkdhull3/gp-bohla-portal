import { useTranslation } from 'react-i18next'
import { SectionSubnav } from './SectionSubnav'

export function FundsSubnav() {
  const { t } = useTranslation()
  return (
    <SectionSubnav
      ariaLabel={t('nav.funds')}
      links={[
        { to: '/funds', label: t('funds.tabSummary'), end: true },
        { to: '/funds/schemes', label: t('funds.tabSchemes') },
        { to: '/funds/vouchers', label: t('funds.tabVouchers') },
      ]}
    />
  )
}
