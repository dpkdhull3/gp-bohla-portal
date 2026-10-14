import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadMeta, loadYearSummaries } from '../lib/data'
import type { PortalMeta, YearSummary } from '../lib/types'
import {
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  clampRange,
  isFyInRange,
} from '../lib/years'

export type YearViewMode = 'range' | 'year'

interface YearContextValue {
  meta: PortalMeta | null
  /** All imported year summary rows (shared — home KPIs/charts use this). */
  yearSummaries: YearSummary[]
  loading: boolean
  error: string | null
  /** Single-year selection (used when viewMode === 'year'). */
  year: string
  setYear: (y: string) => void
  viewMode: YearViewMode
  setViewMode: (m: YearViewMode) => void
  rangeStart: string
  rangeEnd: string
  setRange: (start: string, end: string) => void
  /** True when showing the multi-year range (primary home view). */
  isRangeView: boolean
  /** Years included in the active filter (range or single). */
  activeYears: string[]
  selectSingleYear: (y: string) => void
  resetToDefaultRange: () => void
}

const YearContext = createContext<YearContextValue | null>(null)

export function YearProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PortalMeta | null>(null)
  const [yearSummaries, setYearSummaries] = useState<YearSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(DEFAULT_RANGE_END)
  const [viewMode, setViewMode] = useState<YearViewMode>('range')
  const [rangeStart, setRangeStart] = useState(DEFAULT_RANGE_START)
  const [rangeEnd, setRangeEnd] = useState(DEFAULT_RANGE_END)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadMeta(), loadYearSummaries()])
      .then(([m, ys]) => {
        if (cancelled) return
        setMeta(m)
        setYearSummaries(Array.isArray(ys.years) ? ys.years : [])
        const available = m.availableFinancialYears
        const start = available.includes(DEFAULT_RANGE_START)
          ? DEFAULT_RANGE_START
          : available[0] ?? DEFAULT_RANGE_START
        const end = available.includes(DEFAULT_RANGE_END)
          ? DEFAULT_RANGE_END
          : available[available.length - 1] ?? DEFAULT_RANGE_END
        setRangeStart(start)
        setRangeEnd(end)
        setViewMode('range')
        setYear(m.defaultFinancialYear || end)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setRange = useCallback((start: string, end: string) => {
    const next = clampRange(start, end)
    setRangeStart(next.start)
    setRangeEnd(next.end)
    setViewMode('range')
  }, [])

  const selectSingleYear = useCallback((y: string) => {
    setYear(y)
    setViewMode('year')
  }, [])

  const resetToDefaultRange = useCallback(() => {
    const available = meta?.availableFinancialYears ?? []
    const start = available.includes(DEFAULT_RANGE_START)
      ? DEFAULT_RANGE_START
      : available[0] ?? DEFAULT_RANGE_START
    const end = available.includes(DEFAULT_RANGE_END)
      ? DEFAULT_RANGE_END
      : available[available.length - 1] ?? DEFAULT_RANGE_END
    setRangeStart(start)
    setRangeEnd(end)
    setViewMode('range')
  }, [meta])

  const activeYears = useMemo(() => {
    const available =
      meta?.availableFinancialYears?.length
        ? meta.availableFinancialYears
        : // Before meta loads, still expose the default selected range.
          [
            '2021-22',
            '2022-23',
            '2023-24',
            '2024-25',
            '2025-26',
            '2026-27',
          ].filter((fy) => isFyInRange(fy, rangeStart, rangeEnd))
    if (viewMode === 'year') {
      return available.includes(year) ? [year] : year ? [year] : []
    }
    return available.filter((fy) => isFyInRange(fy, rangeStart, rangeEnd))
  }, [meta, viewMode, year, rangeStart, rangeEnd])

  const value = useMemo(
    () => ({
      meta,
      yearSummaries,
      loading,
      error,
      year,
      setYear: selectSingleYear,
      viewMode,
      setViewMode,
      rangeStart,
      rangeEnd,
      setRange,
      isRangeView: viewMode === 'range',
      activeYears,
      selectSingleYear,
      resetToDefaultRange,
    }),
    [
      meta,
      yearSummaries,
      loading,
      error,
      year,
      selectSingleYear,
      viewMode,
      rangeStart,
      rangeEnd,
      setRange,
      activeYears,
      resetToDefaultRange,
    ],
  )

  return <YearContext.Provider value={value}>{children}</YearContext.Provider>
}

export function useYear() {
  const ctx = useContext(YearContext)
  if (!ctx) throw new Error('useYear must be used within YearProvider')
  return ctx
}
