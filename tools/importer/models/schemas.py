"""Canonical data models for Bohla transparency portal."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class CoverageStatus(str, Enum):
    AVAILABLE = "available"
    EMPTY = "empty"
    MISSING = "missing"
    NOT_APPLICABLE = "not_applicable"


class DataQualityFlag(str, Enum):
    OFFICIAL_REPORTED = "official_reported"
    DERIVED = "derived"
    UNVERIFIED = "unverified"
    SYMBOLIC_AMOUNT = "symbolic_amount"
    UNMATCHED_WORK = "unmatched_work"
    NO_LINKED_VOUCHERS = "no_linked_vouchers"
    NO_LINKED_WORK = "no_linked_work"


class AccountingHead(BaseModel):
    code: str
    label: str
    raw: str


class SourceRef(BaseModel):
    reportName: str
    sourcePath: str
    sourceUrl: Optional[str] = None
    downloadedAt: Optional[str] = None
    sha256: Optional[str] = None
    financialYear: Optional[str] = None
    geographicScope: str = "Gram Panchayat Bohla (LGD 33105)"


class Panchayat(BaseModel):
    lgdCode: int = 33105
    nameEn: str = "Bohla"
    nameHi: str = "बोहला"
    blockEn: str = "Sonipat"
    blockHi: str = "सोनीपत"
    districtEn: str = "Sonipat"
    districtHi: str = "सोनीपत"
    stateEn: str = "Haryana"
    stateHi: str = "हरियाणा"
    stateId: int = 6
    zpCode: Optional[int] = 75
    villageCensusCode: Optional[str] = "150"


class Voucher(BaseModel):
    vId: int
    voucherNo: str
    voucherDate: date
    amountInr: float
    workCode: Optional[str] = None
    majorHead: Optional[AccountingHead] = None
    subMajorHead: Optional[AccountingHead] = None
    minorHead: Optional[AccountingHead] = None
    subHead: Optional[AccountingHead] = None
    detailHead: Optional[AccountingHead] = None
    objectHead: Optional[AccountingHead] = None
    voucherKind: str = "payment"  # payment | receipt | other | unknown
    schemeHint: Optional[str] = None
    lgdCode: int
    lgdName: str
    zpName: Optional[str] = None
    bpName: Optional[str] = None
    financialYear: str
    source: SourceRef
    flags: list[DataQualityFlag] = Field(default_factory=list)


class WorkActivity(BaseModel):
    activityCode: str
    activityName: str
    focusArea: Optional[str] = None
    adminApprovedCostInr: Optional[float] = None
    schemeName: Optional[str] = None
    componentName: Optional[str] = None
    completionDate: Optional[date] = None
    financialYear: str
    statusLabel: str = "completed_as_recorded"
    statusSource: str = "eGramSwaraj Physical Progress wrkstts=176"
    linkedVoucherSumInr: Optional[float] = None
    linkedVoucherCount: int = 0
    source: SourceRef
    flags: list[DataQualityFlag] = Field(default_factory=list)


class PlannedActivity(BaseModel):
    activityCode: str
    activityName: str
    activityDescription: Optional[str] = None
    themeName: Optional[str] = None
    sector: Optional[str] = None
    activityLocation: Optional[str] = None
    locationOfAsset: Optional[str] = None
    estimatedCostInr: Optional[float] = None
    activityType: Optional[str] = None
    schemeName: Optional[str] = None
    generalFundInr: Optional[float] = None
    scFundInr: Optional[float] = None
    stFundInr: Optional[float] = None
    planYear: str
    source: SourceRef
    flags: list[DataQualityFlag] = Field(default_factory=list)


class SchemeRollup(BaseModel):
    schemeName: str
    financialYears: list[str]
    recordedPaymentInr: float = 0
    plannedOutlayInr: Optional[float] = None
    completedWorksCount: int = 0
    plannedActivitiesCount: int = 0
    flags: list[DataQualityFlag] = Field(default_factory=list)


class CoverageItem(BaseModel):
    metric: str
    status: CoverageStatus
    noteEn: str
    noteHi: str
    financialYears: list[str] = Field(default_factory=list)


class PortalMeta(BaseModel):
    panchayat: Panchayat
    lastDataUpdate: str
    availableFinancialYears: list[str]
    defaultFinancialYear: str
    coverage: list[CoverageItem]
    disclaimerEn: str
    disclaimerHi: str
    sources: list[dict[str, Any]] = Field(default_factory=list)


class ImportSummary(BaseModel):
    generatedAt: datetime
    filesProcessed: list[str]
    filesRejected: list[str]
    rowsImported: dict[str, int]
    duplicateRows: list[str]
    missingValues: list[str]
    reconciliationNotes: list[str]
    yearsCovered: list[str]
    schemesCovered: list[str]
