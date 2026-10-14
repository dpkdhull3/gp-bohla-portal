import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReportsSubnav } from '../components/ReportsSubnav'
import { SourceBadge } from '../components/SourceBadge'
import { useYear } from '../context/YearContext'
import { loadDownloads } from '../lib/data'
import type { DownloadItem } from '../lib/types'

export function DownloadsPage() {
  const { t, i18n } = useTranslation()
  const { meta, activeYears } = useYear()
  const [items, setItems] = useState<DownloadItem[]>([])
  const [category, setCategory] = useState('')

  useEffect(() => {
    void loadDownloads().then((d) => setItems(d.records))
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category && item.category !== category) return false
      if (item.financialYear && !activeYears.includes(item.financialYear)) return false
      return true
    })
  }, [items, category, activeYears])

  const categories = [...new Set(items.map((i) => i.category))]

  return (
    <div className="page">
      <ReportsSubnav />
      <h1>{t('downloads.title')}</h1>
      <p className="lede">{t('downloads.intro')}</p>
      <SourceBadge source="Local archived eGramSwaraj exports" updated={meta?.lastDataUpdate} />

      <div className="filters">
        <label>
          {t('downloads.category')}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="download-list">
        {filtered.map((item) => {
          const href = `${import.meta.env.BASE_URL}${item.path.replace(/^\//, '')}`
          return (
            <li key={item.id}>
              <div>
                <strong>{i18n.language === 'hi' ? item.titleHi : item.titleEn}</strong>
                <p className="help">
                  {item.source} · {item.format.toUpperCase()}
                  {item.financialYear ? ` · ${item.financialYear}` : ''}
                </p>
                <span className={item.kind === 'original' ? 'pill pill-official' : 'pill pill-derived'}>
                  {item.kind === 'original' ? t('downloads.original') : t('downloads.derived')}
                </span>
              </div>
              <a className="btn-primary" href={href} download>
                {t('downloads.download')}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
