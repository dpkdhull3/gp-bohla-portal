"""Parse GP voucher JSON exports from eGramSwaraj."""

from __future__ import annotations

import json
from pathlib import Path

from ..config import payment_voucher_detail_url
from ..models.schemas import DataQualityFlag, Voucher
from .common import (
    canonicalize_fy_api,
    infer_scheme_hint,
    infer_voucher_kind,
    parse_accounting_head,
    parse_amount,
    parse_iso_date,
    source_from_meta,
)


EXPECTED_LGD = 33105


def parse_voucher_file(path: Path, api_fin_year: str) -> tuple[list[Voucher], list[str]]:
    """Return (vouchers, warnings). Rejects non-Bohla or malformed rows via warnings."""
    warnings: list[str] = []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path}: expected JSON array, got {type(raw)}")

    fy = canonicalize_fy_api(api_fin_year)
    source = source_from_meta(path, "GP Voucher Details", fy)
    vouchers: list[Voucher] = []
    seen: set[int] = set()

    for idx, row in enumerate(raw):
        try:
            lgd = int(row.get("lgdCode"))
            if lgd != EXPECTED_LGD:
                warnings.append(
                    f"{path.name} row {idx}: rejected lgdCode={lgd} (expected {EXPECTED_LGD})"
                )
                continue
            v_id = int(row["vId"])
            if v_id in seen:
                warnings.append(f"{path.name}: duplicate vId={v_id}")
                continue
            seen.add(v_id)

            voucher_no = str(row["voucherNo"])
            kind = infer_voucher_kind(voucher_no)
            flags: list[DataQualityFlag] = [DataQualityFlag.OFFICIAL_REPORTED]
            work_code = row.get("workCode")
            work_code_s = str(work_code) if work_code not in (None, "") else None
            if work_code_s is None:
                flags.append(DataQualityFlag.NO_LINKED_WORK)

            plan_year = row.get("planYear")
            if plan_year in (0, "0", None):
                warnings.append(f"{path.name} vId={v_id}: planYear is unset/0")

            vouchers.append(
                Voucher(
                    vId=v_id,
                    voucherNo=voucher_no,
                    voucherDate=parse_iso_date(str(row["voucherDate"])),
                    amountInr=parse_amount(row["amount"]),
                    workCode=work_code_s,
                    majorHead=parse_accounting_head(row.get("majorHead")),
                    subMajorHead=parse_accounting_head(row.get("subMajorHead")),
                    minorHead=parse_accounting_head(row.get("minorHead")),
                    subHead=parse_accounting_head(row.get("subHead")),
                    detailHead=parse_accounting_head(row.get("detailHead")),
                    objectHead=parse_accounting_head(row.get("objectHead")),
                    voucherKind=kind,
                    schemeHint=infer_scheme_hint(voucher_no),
                    lgdCode=lgd,
                    lgdName=str(row.get("lgdName") or "Bohla"),
                    zpName=row.get("zpName"),
                    bpName=row.get("bpName"),
                    financialYear=fy,
                    detailUrl=payment_voucher_detail_url(api_fin_year, v_id),
                    source=source,
                    flags=flags,
                )
            )
        except Exception as exc:  # noqa: BLE001 — collect per-row errors
            warnings.append(f"{path.name} row {idx}: malformed — {exc}")

    return vouchers, warnings
