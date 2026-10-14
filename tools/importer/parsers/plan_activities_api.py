"""Parse eGramSwaraj activitySectionData JSON bundles into PlannedActivity rows."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from ..config import plan_yr_to_canonical
from ..models.schemas import DataQualityFlag, PlannedActivity
from .common import parse_amount, source_from_meta

BOHLA_LGD = 33105


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_tied_component(component: str) -> bool:
    lower = component.lower()
    return "tied" in lower and "untied" not in lower


def _is_untied_component(component: str) -> bool:
    lower = component.lower()
    return "untied" in lower or "basic grant" in lower


def tied_untied_from_allocations(
    records: list[dict[str, Any]],
) -> tuple[float, float]:
    """Sum estimated costs into tied vs untied buckets from fundAllocation.componentCode."""
    tied = 0.0
    untied = 0.0
    for row in records:
        allocations = row.get("fundAllocation") or []
        if not isinstance(allocations, list) or not allocations:
            # Fall back to totalCost as untied-unknown → count neither; use total as untied-ish?
            continue
        for alloc in allocations:
            if not isinstance(alloc, dict):
                continue
            component = str(alloc.get("componentCode") or "")
            try:
                amount = parse_amount(alloc.get("amountTotal"))
            except (ValueError, TypeError):
                continue
            if _is_tied_component(component):
                tied += amount
            elif _is_untied_component(component):
                untied += amount
    return tied, untied


def activity_dict_to_planned(
    row: dict[str, Any],
    plan_year: str,
    source_path: Path,
    *,
    activity_no: int | None = None,
) -> Optional[PlannedActivity]:
    """Map one activitySectionData object to PlannedActivity, or None if not Bohla."""
    pln_unt = row.get("plnUntCd")
    if pln_unt is not None and int(pln_unt) != BOHLA_LGD:
        return None

    code_raw = row.get("activityCd")
    if code_raw is None:
        return None
    code = str(code_raw).strip()
    if not re.fullmatch(r"\d+", code):
        return None

    flags = [DataQualityFlag.OFFICIAL_REPORTED]
    est: float | None = None
    try:
        if row.get("totalCost") is not None:
            est = parse_amount(row.get("totalCost"))
            if est is not None and est <= 1:
                flags.append(DataQualityFlag.SYMBOLIC_AMOUNT)
    except (ValueError, TypeError):
        est = None

    allocations = row.get("fundAllocation") or []
    scheme_name: Optional[str] = None
    if isinstance(allocations, list) and allocations:
        first = allocations[0]
        if isinstance(first, dict):
            scheme_name = _clean_text(first.get("schemeCode"))

    location = _clean_text(row.get("location"))
    # API often puts asset location in `location`; activityLocation may be absent.
    activity_stts = _clean_text(row.get("activityStts"))

    source = source_from_meta(
        source_path,
        "eGramSwaraj Plan Activity Section",
        plan_year,
    )

    return PlannedActivity(
        activityCode=code,
        activityName=_clean_text(row.get("activityName")) or code,
        activityDescription=_clean_text(row.get("activityDesc")),
        themeName=_clean_text(row.get("themeName")),
        sector=_clean_text(row.get("focusArea")),
        activityLocation=location,
        locationOfAsset=location,
        estimatedCostInr=est,
        activityType=_clean_text(row.get("activityType")),
        schemeName=scheme_name,
        generalFundInr=None,
        scFundInr=None,
        stFundInr=None,
        planYear=plan_year,
        activityNo=activity_no,
        activityStts=activity_stts,
        source=source,
        flags=flags,
    )


def parse_plan_activities_bundle(
    path: Path, plan_year: str | None = None
) -> tuple[list[PlannedActivity], list[str], float | None, float | None]:
    """
    Parse reports/raw/plan-activities/{planYr}/activities.json.

    Returns (activities, warnings, tied_inr, untied_inr).
    """
    warnings: list[str] = []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path}: expected JSON object bundle")

    records = payload.get("records")
    if not isinstance(records, list):
        raise ValueError(f"{path}: missing records array")

    if plan_year is None:
        plan_year = payload.get("planYear")
        if not plan_year and payload.get("planYr") is not None:
            plan_year = plan_yr_to_canonical(int(payload["planYr"]))
    if not plan_year:
        raise ValueError(f"{path}: cannot determine planYear")

    activities: list[PlannedActivity] = []
    seen: set[str] = set()
    # activityNo = 1-based position in eGram getActivityList.do order
    for idx, row in enumerate(records):
        if not isinstance(row, dict):
            warnings.append(f"{path.name} record {idx}: not an object")
            continue
        try:
            activity = activity_dict_to_planned(
                row, plan_year, path, activity_no=idx + 1
            )
        except (ValueError, TypeError) as exc:
            warnings.append(f"{path.name} record {idx}: {exc}")
            continue
        if activity is None:
            warnings.append(f"{path.name} record {idx}: skipped non-Bohla or invalid")
            continue
        if activity.activityCode in seen:
            warnings.append(f"{path.name}: duplicate activityCode={activity.activityCode}")
            continue
        seen.add(activity.activityCode)
        activities.append(activity)

    tied, untied = tied_untied_from_allocations(
        [r for r in records if isinstance(r, dict)]
    )
    tied_out = tied if tied > 0 else None
    untied_out = untied if untied > 0 else None
    return activities, warnings, tied_out, untied_out


def discover_plan_activity_bundles(raw_root: Path) -> list[tuple[Path, str]]:
    """Return (activities.json path, canonical plan year) for each fetched plan year."""
    root = raw_root / "plan-activities"
    if not root.exists():
        return []
    found: list[tuple[Path, str]] = []
    for year_dir in sorted(root.iterdir()):
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        bundle = year_dir / "activities.json"
        if not bundle.exists():
            continue
        plan_yr = int(year_dir.name)
        found.append((bundle, plan_yr_to_canonical(plan_yr)))
    return found
