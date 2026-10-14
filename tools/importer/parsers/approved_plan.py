"""Parse Approved Action Plan HTML-as-XLS exports for Bohla."""

from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup

from ..models.schemas import DataQualityFlag, PlannedActivity
from .common import parse_amount, source_from_meta


BOHLA_MARKERS = ("Bohla", "बोहला")


def parse_approved_plan_xls(
    path: Path, plan_year: str = "2026-27"
) -> tuple[list[PlannedActivity], list[str]]:
    warnings: list[str] = []
    html = path.read_text(encoding="utf-8", errors="replace")

    # Reject non-Bohla extracts
    if not any(m in html for m in BOHLA_MARKERS):
        raise ValueError(
            f"{path.name}: does not mention Bohla — quarantine/reject (wrong geographic scope)"
        )

    source = source_from_meta(path, "Approved Action Plan Report", plan_year)
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if table is None:
        warnings.append(f"{path.name}: no table")
        return [], warnings

    headers = [th.get_text(" ", strip=True) for th in table.find_all("th")]
    # Map header names to indices
    header_map = {h: i for i, h in enumerate(headers)}

    def cell(row_cells: list[str], *names: str) -> str:
        for name in names:
            if name in header_map and header_map[name] < len(row_cells):
                return row_cells[header_map[name]]
        return ""

    activities: list[PlannedActivity] = []
    seen: set[str] = set()

    for tr in table.find_all("tr"):
        tds = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if not tds:
            continue
        # Skip totals
        if tds[0].lower() in ("total", "grand total"):
            continue

        code = cell(tds, "Activity Code")
        if not re.fullmatch(r"\d+", code):
            continue
        if code in seen:
            warnings.append(f"{path.name}: duplicate activityCode={code}")
            continue
        seen.add(code)

        flags = [DataQualityFlag.OFFICIAL_REPORTED]
        est = None
        try:
            est_raw = cell(tds, "Estimated Cost")
            if est_raw and est_raw.upper() != "N/A":
                est = parse_amount(est_raw)
                if est is not None and est <= 1:
                    flags.append(DataQualityFlag.SYMBOLIC_AMOUNT)
        except ValueError:
            warnings.append(f"{path.name} {code}: bad estimated cost")

        def opt_amount(name: str) -> float | None:
            raw = cell(tds, name)
            if not raw or raw.upper() == "N/A":
                return None
            try:
                return parse_amount(raw)
            except ValueError:
                return None

        activities.append(
            PlannedActivity(
                activityCode=code,
                activityName=cell(tds, "Activity Name"),
                activityDescription=cell(tds, "Activity Description") or None,
                themeName=cell(tds, "Theme Name") or None,
                sector=cell(tds, "Sector") or None,
                activityLocation=cell(tds, "Activity Location") or None,
                locationOfAsset=cell(tds, "Location of Asset") or None,
                estimatedCostInr=est,
                activityType=cell(tds, "Activity Type") or None,
                schemeName=cell(tds, "Scheme Name") or None,
                generalFundInr=opt_amount("General Fund"),
                scFundInr=opt_amount("SC Fund"),
                stFundInr=opt_amount("ST Fund"),
                planYear=plan_year,
                source=source,
                flags=flags,
            )
        )

    return activities, warnings
