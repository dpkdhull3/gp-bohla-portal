import { useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SectionSubnav } from './SectionSubnav'
import { YearSelector } from './YearSelector'
import { useYear } from '../context/YearContext'
import {
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  lastNFinancialYears,
} from '../lib/years'

const SECTION_LINKS = [
  { to: '/', labelKey: 'nav.overviewShort', end: true },
  { to: '/grants', labelKey: 'nav.grantsShort', end: true },
  { to: '/payments', labelKey: 'nav.paymentsShort', end: true },
] as const

function isSectionActive(pathname: string, to: string, end?: boolean): boolean {
  if (to === '/') return pathname === '/'
  if (to === '/grants') {
    return pathname === '/grants' || pathname.startsWith('/grants/') || pathname.startsWith('/works')
  }
  if (to === '/payments') {
    return (
      pathname === '/payments' ||
      pathname.startsWith('/payments/') ||
      pathname === '/funds/vouchers' ||
      pathname === '/vouchers' ||
      pathname.startsWith('/funds')
    )
  }
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Layout() {
  const { t, i18n } = useTranslation()
  const { meta, isRangeView, year, resetToDefaultRange, selectSingleYear } = useYear()
  const { pathname } = useLocation()

  const yearTabs = useMemo(() => {
    const available = meta?.availableFinancialYears?.length
      ? meta.availableFinancialYears
      : [
          DEFAULT_RANGE_START,
          '2021-22',
          '2022-23',
          '2023-24',
          '2024-25',
          '2025-26',
          DEFAULT_RANGE_END,
        ]
    // Show full imported span including 2020-21 and 2021-22
    return lastNFinancialYears(available, 7)
  }, [meta])

  const toggleLang = () => {
    const next = i18n.language === 'hi' ? 'en' : 'hi'
    void i18n.changeLanguage(next)
    document.documentElement.lang = next
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      <header className="site-header site-header-compact">
        <div className="header-inner">
          <div className="brand-block">
            <p className="brand-name">{t('brandShort')}</p>
            <p className="brand-place">{t('place.compact')}</p>
          </div>
          <div className="header-actions">
            <YearSelector compact />
            <button
              type="button"
              className="lang-btn"
              onClick={toggleLang}
              aria-label={t('lang.switch')}
            >
              {i18n.language === 'hi' ? t('lang.en') : t('lang.hi')}
            </button>
          </div>
        </div>

        <nav id="site-nav" className="site-nav site-nav-compact" aria-label={t('nav.primary')}>
          <button
            type="button"
            className={isRangeView ? 'nav-link active' : 'nav-link'}
            onClick={() => resetToDefaultRange()}
            title={t('nav.periodRange')}
            aria-pressed={isRangeView}
          >
            <span className="nav-link-label">{t('nav.periodRangeShort')}</span>
          </button>
          {yearTabs.map((fy) => {
            const active = !isRangeView && year === fy
            return (
              <button
                key={fy}
                type="button"
                className={active ? 'nav-link active' : 'nav-link'}
                onClick={() => selectSingleYear(fy)}
                title={t('nav.periodYearNamed', { year: fy })}
                aria-pressed={active}
              >
                <span className="nav-link-label">{fy}</span>
              </button>
            )
          })}
        </nav>

        <div className="header-section-nav">
          <SectionSubnav
            ariaLabel={t('nav.sections')}
            links={SECTION_LINKS.map((link) => ({
              to: link.to,
              label: t(link.labelKey),
              end: 'end' in link ? link.end : undefined,
            }))}
            isActive={(to, end) => isSectionActive(pathname, to, end)}
          />
        </div>
      </header>
      <main id="main" className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p className="banner-notice banner-notice-footer">{t('common.independentNotice')}</p>
        <p>{meta ? (i18n.language === 'hi' ? meta.disclaimerHi : meta.disclaimerEn) : null}</p>
        <p>
          {t('common.updated')}: {meta?.lastDataUpdate ?? '—'} · {t('common.lgd')}{' '}
          {meta?.panchayat.lgdCode ?? 33105}
        </p>
      </footer>
    </div>
  )
}
