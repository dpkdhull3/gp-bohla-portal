"""Parse Physical Progress HTML reports."""

from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup

from ..models.schemas import DataQualityFlag, WorkActivity
from .common import (
    FYEAR_TO_CANONICAL,
    parse_amount,
    parse_iso_date,
    source_from_meta,
)


def parse_physical_progress_file(path: Path, fyear: int) -> tuple[list[WorkActivity], list[str]]:
    warnings: list[str] = []
    fy = FYEAR_TO_CANONICAL[fyear]
    source = source_from_meta(path, "Physical Progress Report", fy)
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")

    table = soup.find("table")
    if table is None:
        warnings.append(f"{path.name}: no table found")
        return [], warnings

    works: list[WorkActivity] = []
    seen: set[str] = set()
    for tr in table.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
        if len(cells) < 8:
            continue
        # Expected: S.No, Activity Code, Name, Focus Area, Cost, Scheme, Component, Date
        activity_code = cells[1].strip()
        if not re.fullmatch(r"\d+", activity_code):
            warnings.append(f"{path.name}: skipped non-numeric activity code {activity_code!r}")
            continue
        if activity_code in seen:
            warnings.append(f"{path.name}: duplicate activityCode={activity_code}")
            continue
        seen.add(activity_code)

        flags = [DataQualityFlag.OFFICIAL_REPORTED]
        try:
            cost = parse_amount(cells[4])
        except ValueError:
            cost = None
            warnings.append(f"{path.name} {activity_code}: missing approved cost")

        completion = None
        try:
            completion = parse_iso_date(cells[7])
        except ValueError:
            warnings.append(f"{path.name} {activity_code}: bad completion date {cells[7]!r}")

        works.append(
            WorkActivity(
                activityCode=activity_code,
                activityName=cells[2],
                focusArea=cells[3] or None,
                adminApprovedCostInr=cost,
                schemeName=cells[5] or None,
                componentName=cells[6] or None,
                completionDate=completion,
                financialYear=fy,
                statusLabel="completed_as_recorded",
                statusSource="eGramSwaraj Physical Progress wrkstts=176",
                source=source,
                flags=flags,
            )
        )

    return works, warnings
