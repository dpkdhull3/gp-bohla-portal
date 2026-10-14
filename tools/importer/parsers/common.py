"""Shared parsing helpers."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from ..models.schemas import AccountingHead, SourceRef


FY_API_TO_CANONICAL = {
    "2020-2021": "2020-21",
    "2021-2022": "2021-22",
    "2022-2023": "2022-23",
    "2023-2024": "2023-24",
    "2024-2025": "2024-25",
    "2025-2026": "2025-26",
    "2026-2027": "2026-27",
}

FYEAR_TO_CANONICAL = {
    2020: "2020-21",
    2021: "2021-22",
    2022: "2022-23",
    2023: "2023-24",
    2024: "2024-25",
    2025: "2025-26",
    2026: "2026-27",
}


def canonicalize_fy_api(fin_year: str) -> str:
    if fin_year in FY_API_TO_CANONICAL:
        return FY_API_TO_CANONICAL[fin_year]
    # already canonical like 2025-26
    if re.fullmatch(r"\d{4}-\d{2}", fin_year):
        return fin_year
    # 2025-2026 already handled; try normalize
    m = re.fullmatch(r"(\d{4})-(\d{4})", fin_year)
    if m:
        return f"{m.group(1)}-{m.group(2)[2:]}"
    raise ValueError(f"Unrecognized financial year: {fin_year}")


def parse_accounting_head(raw: Optional[str]) -> Optional[AccountingHead]:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text or text in ("00-", "0-", "-"):
        return AccountingHead(code="", label="", raw=text)
    # Patterns like "2215-Water Supply and Sanitation" or "50-O and M ..."
    m = re.match(r"^([0-9A-Za-z]+)\s*-\s*(.*)$", text)
    if m:
        return AccountingHead(code=m.group(1), label=m.group(2).strip(), raw=text)
    return AccountingHead(code="", label=text, raw=text)


def parse_iso_date(value: str) -> date:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19] if " " in value else value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date: {value}")


def parse_amount(value: Any) -> float:
    if value is None or value == "":
        raise ValueError("Missing amount")
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").replace("₹", "").strip()
    return float(text)


def infer_voucher_kind(voucher_no: str) -> str:
    if "/P/" in voucher_no:
        return "payment"
    if "/R/" in voucher_no:
        return "receipt"
    return "unknown"


def infer_scheme_hint(voucher_no: str) -> Optional[str]:
    prefix = voucher_no.split("/")[0] if voucher_no else ""
    mapping = {
        "XVFC": "XV Finance Commission",
        "XVI FC": "XVI Finance Commission",
        "XVIFC": "XVI Finance Commission",
        "SBM": "Swachh Bharat Mission",
        "MGNREGA": "MGNREGA",
        "OWN": "Own Funds",
    }
    return mapping.get(prefix)


def load_meta(path: Path) -> dict[str, Any]:
    meta_path = path.with_suffix(path.suffix + ".meta.json")
    if not meta_path.exists():
        # also try replacing .json with .meta.json already handled; for .html
        alt = Path(str(path) + ".meta.json")
        if alt.exists():
            meta_path = alt
        else:
            return {}
    return json.loads(meta_path.read_text(encoding="utf-8"))


def source_from_meta(path: Path, report_name: str, financial_year: Optional[str] = None) -> SourceRef:
    meta = load_meta(path)
    return SourceRef(
        reportName=meta.get("reportName", report_name),
        sourcePath=str(path),
        sourceUrl=meta.get("sourceUrl"),
        downloadedAt=meta.get("downloadedAt"),
        sha256=meta.get("sha256") or hashlib.sha256(path.read_bytes()).hexdigest(),
        financialYear=financial_year or meta.get("financialYear"),
        geographicScope=meta.get(
            "geographicScope", "Gram Panchayat Bohla (LGD 33105)"
        ),
    )


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
