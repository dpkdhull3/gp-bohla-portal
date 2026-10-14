"""Download Bohla reports from public eGramSwaraj endpoints into reports/raw/."""

from __future__ import annotations

import hashlib
import json
import re
import ssl
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import (
    BASE_URL,
    BOHLA,
    DEFAULT_PLAN_YR_FROM,
    DEFAULT_PLAN_YR_TO,
    iter_plan_years,
    payment_voucher_detail_url,
    plan_yr_to_canonical,
    voucher_api_fy,
)

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "reports" / "raw"

REFERER = f"{BASE_URL}/planWiseActivitiesDetails.do"
USER_AGENT = "gp-bohla-portal-importer/0.1 (+https://github.com/local; public data refresh)"

ACTIVITY_CODE_RE = re.compile(r"\((\d+)\)\s*$")


@dataclass
class FetchResult:
    files_written: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    plan_years: list[int] = field(default_factory=list)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _curl_get(url: str, headers: dict[str, str], timeout: int) -> bytes:
    cmd = [
        "curl",
        "-sS",
        "--fail",
        "--max-time",
        str(timeout),
        url,
        "-H",
        f"Accept: {headers['Accept']}",
        "-H",
        f"Referer: {headers['Referer']}",
        "-H",
        f"User-Agent: {headers['User-Agent']}",
    ]
    return subprocess.check_output(cmd)


def _http_get(url: str, timeout: int = 60) -> bytes:
    """GET with urllib; fall back to curl on SSL or proxy/tunnel failures."""
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Referer": REFERER,
        "User-Agent": USER_AGENT,
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (ssl.SSLError, urllib.error.URLError, OSError):
        return _curl_get(url, headers, timeout)


def _write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def _write_meta(
    path: Path,
    *,
    report_name: str,
    source_url: str,
    parameters: dict[str, Any],
    fmt: str,
    financial_year: Optional[str] = None,
) -> None:
    meta = {
        "reportName": report_name,
        "sourceUrl": source_url,
        "parameters": parameters,
        "downloadedAt": _now_iso(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "byteSize": path.stat().st_size,
        "geographicScope": "Gram Panchayat Bohla (LGD 33105)",
        "format": fmt,
    }
    if financial_year:
        meta["financialYear"] = financial_year
    meta_path = Path(str(path) + ".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _json_get(url: str) -> Any:
    raw = _http_get(url)
    if not raw or raw in (b"[]", b"null"):
        return json.loads(raw) if raw else None
    return json.loads(raw.decode("utf-8"))


def _activity_codes_from_list(labels: list[str]) -> list[int]:
    codes: list[int] = []
    for label in labels:
        m = ACTIVITY_CODE_RE.search(str(label))
        if m:
            codes.append(int(m.group(1)))
    return codes


def fetch_plan_year(plan_yr: int, result: FetchResult) -> None:
    """Fetch plan list → activity list → per-activity section JSON for one plan year."""
    geo = BOHLA
    canon = plan_yr_to_canonical(plan_yr)
    out_dir = RAW / "plan-activities" / str(plan_yr)
    out_dir.mkdir(parents=True, exist_ok=True)

    plan_qs = urllib.parse.urlencode(
        {
            "planYr": plan_yr,
            "stateCd": geo.state_cd,
            "zpCd": geo.zp_cd,
            "bpCd": geo.bp_cd,
            "typCd": geo.typ_cd,
            "level": geo.level,
        }
    )
    plan_url = f"{BASE_URL}/getPlanVpData.do?{plan_qs}"
    plans = _json_get(plan_url)
    if not isinstance(plans, list):
        result.warnings.append(f"planYr={plan_yr}: getPlanVpData returned non-list")
        return

    plan_path = out_dir / "getPlanVpData.json"
    _write_bytes(plan_path, json.dumps(plans, ensure_ascii=False, indent=2).encode("utf-8") + b"\n")
    _write_meta(
        plan_path,
        report_name="Plan VP Data",
        source_url=plan_url,
        parameters={
            "planYr": plan_yr,
            "stateCd": geo.state_cd,
            "zpCd": geo.zp_cd,
            "bpCd": geo.bp_cd,
            "typCd": geo.typ_cd,
            "level": geo.level,
        },
        fmt="application/json",
        financial_year=canon,
    )
    result.files_written.append(str(plan_path.relative_to(ROOT)))

    bohla = [p for p in plans if int(p.get("gp_cd") or 0) == geo.lgd_code]
    if not bohla:
        result.warnings.append(f"planYr={plan_yr}: no Bohla row in getPlanVpData")
        return

    plan_cd = int(bohla[0]["plan_cd"])
    act_qs = urllib.parse.urlencode({"planCd": plan_cd, "activityStts": 0})
    act_url = f"{BASE_URL}/getActivityList.do?{act_qs}"
    activity_labels = _json_get(act_url)
    if not isinstance(activity_labels, list):
        result.warnings.append(f"planYr={plan_yr} planCd={plan_cd}: getActivityList non-list")
        return

    list_path = out_dir / "getActivityList.json"
    list_payload = {
        "planCd": plan_cd,
        "planYr": plan_yr,
        "gp_cd": geo.lgd_code,
        "gp_nam": bohla[0].get("gp_nam"),
        "activities": activity_labels,
    }
    _write_bytes(
        list_path,
        json.dumps(list_payload, ensure_ascii=False, indent=2).encode("utf-8") + b"\n",
    )
    _write_meta(
        list_path,
        report_name="Plan Activity List",
        source_url=act_url,
        parameters={"planCd": plan_cd, "activityStts": 0},
        fmt="application/json",
        financial_year=canon,
    )
    result.files_written.append(str(list_path.relative_to(ROOT)))

    codes = _activity_codes_from_list(activity_labels)
    sections_dir = out_dir / "activities"
    sections_dir.mkdir(parents=True, exist_ok=True)
    details: list[dict[str, Any]] = []

    for code in codes:
        detail_url = f"{BASE_URL}/activitySectionData.do?activityCd={code}"
        detail = _json_get(detail_url)
        if not isinstance(detail, dict):
            result.warnings.append(f"planYr={plan_yr} activityCd={code}: empty/invalid section")
            continue
        details.append(detail)
        detail_path = sections_dir / f"{code}.json"
        _write_bytes(
            detail_path,
            json.dumps(detail, ensure_ascii=False, indent=2).encode("utf-8") + b"\n",
        )
        _write_meta(
            detail_path,
            report_name="Activity Section Data",
            source_url=detail_url,
            parameters={"activityCd": code},
            fmt="application/json",
            financial_year=canon,
        )
        result.files_written.append(str(detail_path.relative_to(ROOT)))

    bundle_path = out_dir / "activities.json"
    bundle = {
        "planYr": plan_yr,
        "planYear": canon,
        "planCd": plan_cd,
        "gp_cd": geo.lgd_code,
        "count": len(details),
        "records": details,
        "sourceUrls": {
            "getPlanVpData": plan_url,
            "getActivityList": act_url,
            "activitySectionData": f"{BASE_URL}/activitySectionData.do?activityCd={{activityCd}}",
        },
    }
    _write_bytes(
        bundle_path,
        json.dumps(bundle, ensure_ascii=False, indent=2).encode("utf-8") + b"\n",
    )
    _write_meta(
        bundle_path,
        report_name="Plan Activities Bundle",
        source_url=act_url,
        parameters={"planCd": plan_cd, "planYr": plan_yr, "activityCount": len(details)},
        fmt="application/json",
        financial_year=canon,
    )
    result.files_written.append(str(bundle_path.relative_to(ROOT)))
    result.plan_years.append(plan_yr)


def fetch_voucher_detail(plan_yr: int, voucher_id: int, result: FetchResult) -> None:
    geo = BOHLA
    api_fy = voucher_api_fy(plan_yr)
    canon = plan_yr_to_canonical(plan_yr)
    url = payment_voucher_detail_url(api_fy, voucher_id)
    html = _http_get(url)
    path = RAW / "vouchers" / "details" / api_fy / f"{voucher_id}.html"
    _write_bytes(path, html)
    _write_meta(
        path,
        report_name="Payment Voucher Detail",
        source_url=url,
        parameters={
            "finYear": api_fy,
            "PRIEntity_code": geo.lgd_code,
            "stateCode": geo.state_cd,
            "voucherID": voucher_id,
        },
        fmt="text/html",
        financial_year=canon,
    )
    result.files_written.append(str(path.relative_to(ROOT)))


def fetch_vouchers(
    plan_yr: int,
    result: FetchResult,
    *,
    details: bool = True,
) -> None:
    geo = BOHLA
    api_fy = voucher_api_fy(plan_yr)
    canon = plan_yr_to_canonical(plan_yr)
    qs = urllib.parse.urlencode(
        {"finYear": api_fy, "stateId": geo.state_cd, "lgdCode": geo.lgd_code}
    )
    url = f"{BASE_URL}/getGPVoucherDetailsData.do?{qs}"
    raw = _http_get(url)
    try:
        data = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        result.warnings.append(f"vouchers {api_fy}: non-JSON response")
        return
    if not isinstance(data, list):
        result.warnings.append(f"vouchers {api_fy}: expected list")
        return

    path = RAW / "vouchers" / f"{api_fy}.json"
    _write_bytes(path, json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8") + b"\n")
    _write_meta(
        path,
        report_name="GP Voucher Details",
        source_url=url,
        parameters={"finYear": api_fy, "stateId": geo.state_cd, "lgdCode": geo.lgd_code},
        fmt="application/json",
        financial_year=canon,
    )
    result.files_written.append(str(path.relative_to(ROOT)))

    if not details:
        return

    for row in data:
        try:
            v_id = int(row["vId"])
        except (KeyError, TypeError, ValueError):
            continue
        try:
            fetch_voucher_detail(plan_yr, v_id, result)
        except Exception as exc:  # noqa: BLE001
            result.warnings.append(f"voucher detail {api_fy}/{v_id}: {exc}")


def fetch_physical_progress(plan_yr: int, result: FetchResult) -> None:
    geo = BOHLA
    canon = plan_yr_to_canonical(plan_yr)
    qs = urllib.parse.urlencode(
        {
            "statecd": geo.state_cd,
            "fyear": plan_yr,
            "gpcd": geo.lgd_code,
            "wrkstts": geo.wrkstts_completed,
        }
    )
    url = f"{BASE_URL}/physicalprogressReport.do?{qs}"
    html = _http_get(url)
    path = RAW / "physical-progress" / f"fyear-{plan_yr}-wrkstts-{geo.wrkstts_completed}.html"
    _write_bytes(path, html)
    meta_extra = {
        "reportName": "Physical Progress Report",
        "sourceUrl": url,
        "parameters": {
            "statecd": geo.state_cd,
            "fyear": plan_yr,
            "gpcd": geo.lgd_code,
            "wrkstts": geo.wrkstts_completed,
        },
        "statusInterpretation": (
            "wrkstts=176 returns rows with Date of Completion; "
            "treat as completed-as-recorded-in-eGramSwaraj"
        ),
        "downloadedAt": _now_iso(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "byteSize": path.stat().st_size,
        "geographicScope": "Gram Panchayat Bohla (LGD 33105)",
        "format": "text/html",
        "financialYear": canon,
    }
    Path(str(path) + ".meta.json").write_text(
        json.dumps(meta_extra, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    result.files_written.append(str(path.relative_to(ROOT)))


def fetch_all(
    from_yr: int = DEFAULT_PLAN_YR_FROM,
    to_yr: int = DEFAULT_PLAN_YR_TO,
    *,
    plans: bool = True,
    vouchers: bool = True,
    voucher_details: bool = True,
    physical_progress: bool = True,
) -> FetchResult:
    """Fetch configured year range into reports/raw/."""
    result = FetchResult()
    years = iter_plan_years(from_yr, to_yr)
    for plan_yr in years:
        if plans:
            try:
                fetch_plan_year(plan_yr, result)
            except Exception as exc:  # noqa: BLE001 — collect per-year failures
                result.warnings.append(f"planYr={plan_yr} plan fetch failed: {exc}")
        if vouchers:
            try:
                fetch_vouchers(plan_yr, result, details=voucher_details)
            except Exception as exc:  # noqa: BLE001
                result.warnings.append(f"planYr={plan_yr} voucher fetch failed: {exc}")
        if physical_progress:
            try:
                fetch_physical_progress(plan_yr, result)
            except Exception as exc:  # noqa: BLE001
                result.warnings.append(f"planYr={plan_yr} physical-progress fetch failed: {exc}")
    return result
