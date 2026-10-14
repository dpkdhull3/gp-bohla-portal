"""Parse eGramSwaraj getPaymentVoucherDetail.do HTML into structured JSON."""

from __future__ import annotations

import html as html_lib
import re
from pathlib import Path

from bs4 import BeautifulSoup

from ..config import payment_voucher_detail_url
from ..models.schemas import SourceRef, VoucherDetail, VoucherPaymentLine
from .common import canonicalize_fy_api, parse_amount, source_from_meta

LABELS = {
    "financial year": "financialYear",
    "month": "month",
    "type of transaction": "transactionType",
    "activity code": "activityCode",
    "scheme name": "schemeName",
    "voucher date": "voucherDate",
    "voucher no": "voucherNo",
    "particulars": "particulars",
    "attached file": "attachedFile",
}


def _plain_lines(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    text = html_lib.unescape(text)
    lines: list[str] = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or line in {"-->", "&nbsp;"}:
            continue
        lines.append(line)
    return lines


def _norm_label(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower().rstrip(":")


def parse_voucher_detail_html(
    path: Path,
    *,
    v_id: int,
    api_fin_year: str,
) -> VoucherDetail:
    html = path.read_text(encoding="utf-8", errors="replace")
    lines = _plain_lines(html)
    fy = canonicalize_fy_api(api_fin_year)
    detail_url = payment_voucher_detail_url(api_fin_year, v_id)
    source = source_from_meta(path, "Payment Voucher Detail", fy)
    if not source.sourceUrl:
        source = SourceRef(
            reportName=source.reportName,
            sourcePath=source.sourcePath,
            sourceUrl=detail_url,
            downloadedAt=source.downloadedAt,
            sha256=source.sha256,
            financialYear=fy,
        )

    fields: dict[str, str] = {}
    account_heads: list[str] = []
    activity_label: str | None = None
    amount_inr: float | None = None
    payments: list[VoucherPaymentLine] = []

    i = 0
    in_account = False
    in_payment = False
    while i < len(lines):
        label = _norm_label(lines[i])
        key = LABELS.get(label)

        if label == "account head":
            in_account = True
            in_payment = False
            i += 1
            continue
        if label in {"mode of payment", "details"}:
            in_account = False
            if label == "mode of payment":
                in_payment = True
            i += 1
            continue
        if label in {"to whom paid", "amount (in rs.)", "amount (in rs)"} and in_payment:
            i += 1
            continue

        if key and i + 1 < len(lines):
            in_account = False
            value = lines[i + 1].strip()
            # Skip if next line is another known label
            if _norm_label(value) in LABELS or _norm_label(value) in {
                "account head",
                "mode of payment",
                "details",
                "to whom paid",
                "amount (in rs.)",
                "amount (in rs)",
                "expenditure heads",
            }:
                i += 1
                continue
            fields[key] = value
            if key == "activityCode" and i + 2 < len(lines):
                nxt = lines[i + 2]
                nxt_l = _norm_label(nxt)
                if nxt_l not in LABELS and nxt_l not in {
                    "account head",
                    "scheme name",
                    "voucher date",
                }:
                    activity_label = nxt
                    i += 3
                    continue
            i += 2
            continue

        if in_account:
            if label.startswith("amount"):
                in_account = False
                if i + 1 < len(lines):
                    try:
                        amount_inr = parse_amount(lines[i + 1].replace(",", ""))
                    except Exception:  # noqa: BLE001
                        amount_inr = None
                    i += 2
                    continue
            if label not in {"expenditure heads"} and not label.startswith("report generated"):
                account_heads.append(lines[i])
            i += 1
            continue

        if in_payment and label == "pfms":
            mode = "PFMS"
            account_type = None
            account_no = None
            payee = None
            pay_amount = None
            j = i + 1
            while j < len(lines):
                chunk = lines[j]
                cl = _norm_label(chunk)
                if cl.startswith("report generated") or cl in {
                    "export to pdf",
                    "back",
                    "close",
                    "sitemap",
                    "mode of payment",
                    "pfms",
                }:
                    break
                if cl.startswith("account type"):
                    account_type = chunk.split(":", 1)[-1].strip() if ":" in chunk else chunk
                elif cl.startswith("account no"):
                    account_no = chunk.split(":", 1)[-1].strip() if ":" in chunk else chunk
                elif re.fullmatch(r"[\d,]+(?:\.\d+)?", chunk.replace(" ", "")):
                    try:
                        pay_amount = parse_amount(chunk.replace(",", ""))
                    except Exception:  # noqa: BLE001
                        pay_amount = None
                    j += 1
                    break
                elif not cl.startswith("amount") and payee is None:
                    payee = chunk
                j += 1
            payments.append(
                VoucherPaymentLine(
                    modeOfPayment=mode,
                    accountType=account_type,
                    accountNoMasked=account_no,
                    payeeName=payee,
                    amountInr=pay_amount,
                )
            )
            in_payment = False
            i = j
            continue

        i += 1

    if amount_inr is None and "amount" in { _norm_label(x) for x in lines }:
        pass

    return VoucherDetail(
        vId=v_id,
        financialYear=fy,
        apiFinancialYear=api_fin_year,
        detailUrl=detail_url,
        month=fields.get("month"),
        transactionType=fields.get("transactionType"),
        activityCode=fields.get("activityCode"),
        activityLabel=activity_label,
        schemeName=fields.get("schemeName"),
        voucherDate=fields.get("voucherDate"),
        voucherNo=fields.get("voucherNo"),
        accountHeads=account_heads,
        amountInr=amount_inr,
        particulars=fields.get("particulars"),
        attachedFile=fields.get("attachedFile"),
        payments=payments,
        source=source,
    )


def parse_voucher_detail_file(
    path: Path,
    *,
    v_id: int,
    api_fin_year: str,
) -> tuple[VoucherDetail | None, list[str]]:
    warnings: list[str] = []
    try:
        detail = parse_voucher_detail_html(path, v_id=v_id, api_fin_year=api_fin_year)
        if not detail.voucherNo and not detail.particulars and not detail.payments:
            warnings.append(f"{path.name}: parsed but little content found")
        return detail, warnings
    except Exception as exc:  # noqa: BLE001
        return None, [f"{path.name}: parse failed — {exc}"]
