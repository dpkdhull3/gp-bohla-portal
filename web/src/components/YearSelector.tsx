import { useTranslation } from 'react-i18next'
import { useYear } from '../context/YearContext'
import { DEFAULT_RANGE_END, DEFAULT_RANGE_START } from '../lib/years'

interface Props {
  compact?: boolean
}

export function YearSelector({ compact = false }: Props) {
  const { t } = useTranslation()
  const {
    meta,
    year,
    viewMode,
    rangeStart,
    rangeEnd,
    setRange,
    selectSingleYear,
    resetToDefaultRange,
  } = useYear()
  const years = meta?.availableFinancialYears ?? []

  const selectValue =
    viewMode === 'range' &&
    rangeStart === DEFAULT_RANGE_START &&
    rangeEnd === DEFAULT_RANGE_END
      ? '__default_range__'
      : viewMode === 'range'
        ? '__custom_range__'
        : year

  return (
    <div className={compact ? 'year-selector year-selector-compact' : 'year-selector'}>
      {!compact ? <label htmlFor="fy-select">{t('common.financialYear')}</label> : null}
      <div className="year-selector-row">
        <select
          id="fy-select"
          value={selectValue}
          aria-label={t('common.financialYear')}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__default_range__') {
              resetToDefaultRange()
              return
            }
            if (v === '__custom_range__') {
              setRange(rangeStart, rangeEnd)
              return
            }
            selectSingleYear(v)
          }}
        >
          <option value="__default_range__">
            {t('common.defaultRangeShort', {
              start: DEFAULT_RANGE_START,
              end: DEFAULT_RANGE_END,
            })}
          </option>
          <option value="__custom_range__">{t('common.customRange')}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {viewMode === 'range' ? (
          <div className="range-inputs" role="group" aria-label={t('common.rangeGroup')}>
            <select
              value={rangeStart}
              aria-label={t('common.from')}
              onChange={(e) => setRange(e.target.value, rangeEnd)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="range-sep" aria-hidden>
              –
            </span>
            <select
              value={rangeEnd}
              aria-label={t('common.to')}
              onChange={(e) => setRange(rangeStart, e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
