export interface Panchayat {
  lgdCode: number
  nameEn: string
  nameHi: string
  blockEn: string
  blockHi: string
  districtEn: string
  districtHi: string
  stateEn: string
  stateHi: string
  stateId: number
  zpCode?: number
}

export interface CoverageItem {
  metric: string
  status: 'available' | 'empty' | 'missing' | 'not_applicable'
  noteEn: string
  noteHi: string
  financialYears: string[]
}

export interface PortalMeta {
  panchayat: Panchayat
  lastDataUpdate: string
  availableFinancialYears: string[]
  defaultFinancialYear: string
  coverage: CoverageItem[]
  disclaimerEn: string
  disclaimerHi: string
  sources: { name: string; url: string }[]
}

export interface AccountingHead {
  code: string
  label: string
  raw: string
}

export interface Voucher {
  vId: number
  voucherNo: string
  voucherDate: string
  amountInr: number
  workCode?: string | null
  majorHead?: AccountingHead | null
  objectHead?: AccountingHead | null
  voucherKind: string
  schemeHint?: string | null
  financialYear: string
  flags: string[]
  source?: { reportName: string; sourceUrl?: string }
}

export interface WorkActivity {
  activityCode: string
  activityName: string
  focusArea?: string | null
  adminApprovedCostInr?: number | null
  schemeName?: string | null
  componentName?: string | null
  completionDate?: string | null
  financialYear: string
  statusLabel: string
  linkedVoucherSumInr?: number | null
  linkedVoucherCount: number
  flags: string[]
}

export interface PlannedActivity {
  activityCode: string
  activityName: string
  activityDescription?: string | null
  sector?: string | null
  estimatedCostInr?: number | null
  schemeName?: string | null
  themeName?: string | null
  activityLocation?: string | null
  locationOfAsset?: string | null
  activityType?: string | null
  generalFundInr?: number | null
  scFundInr?: number | null
  stFundInr?: number | null
  planYear: string
  flags: string[]
}

export interface PlanYearFile {
  planYear: string
  count: number
  totalEstimatedCostInr: number
  pdfPath?: string | null
  xlsPath?: string | null
  records: PlannedActivity[]
}

export interface PlanIndex {
  years: string[]
  plans: Array<{
    planYear: string
    count: number
    totalEstimatedCostInr: number
    pdfPath?: string | null
    xlsPath?: string | null
  }>
  noteEn?: string
  noteHi?: string
}

export interface SchemeRollup {
  schemeName: string
  financialYears: string[]
  recordedPaymentInr: number
  plannedOutlayInr?: number | null
  completedWorksCount: number
  plannedActivitiesCount: number
}

export interface YearSummary {
  financialYear: string
  recordedPaymentInr: number
  recordedReceiptInr: number
  voucherCount: number
  completedWorksCount: number
  adminApprovedWorksInr: number
  openingBalanceInr: number | null
  closingBalanceInr: number | null
  fundsReceivedInr: number | null
  balanceCoverage: string
  notes: string[]
}

export interface DownloadItem {
  id: string
  titleEn: string
  titleHi: string
  category: string
  financialYear?: string | null
  kind: 'original' | 'derived'
  format: string
  path: string
  source: string
}
