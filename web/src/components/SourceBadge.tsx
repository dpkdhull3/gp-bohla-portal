import { useTranslation } from 'react-i18next'

interface Props {
  source: string
  financialYear?: string
  quality?: 'official' | 'derived'
  updated?: string
}

export function SourceBadge({ source, financialYear, quality = 'official', updated }: Props) {
  const { t } = useTranslation()
  return (
    <div className="source-badge" role="note">
      <span>
        {t('common.source')}: {source}
      </span>
      {financialYear ? (
        <span>
          {t('common.financialYear')}: {financialYear}
        </span>
      ) : null}
      {updated ? (
        <span>
          {t('common.updated')}: {updated}
        </span>
      ) : null}
      <span className={quality === 'derived' ? 'pill pill-derived' : 'pill pill-official'}>
        {quality === 'derived' ? t('common.derived') : t('common.official')}
      </span>
    </div>
  )
}
