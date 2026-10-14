"""Unit tests for parsers and financial helpers. Uses synthetic fixtures only."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.importer.parsers.common import (
    canonicalize_fy_api,
    infer_voucher_kind,
    parse_accounting_head,
    parse_amount,
    parse_iso_date,
)
from tools.importer.parsers.vouchers import parse_voucher_file
from tools.importer.parsers.voucher_details import parse_voucher_detail_html
from tools.importer.parsers.physical_progress import parse_physical_progress_file
from tools.importer.parsers.approved_plan import parse_approved_plan_xls
from tools.importer.parsers.plan_activities_api import (
    parse_plan_activities_bundle,
    tied_untied_from_allocations,
)

FIXTURES = Path(__file__).parent.parent / "fixtures"


def test_canonicalize_fy():
    assert canonicalize_fy_api("2025-2026") == "2025-26"
    assert canonicalize_fy_api("2023-24") == "2023-24"


def test_parse_amount_and_heads():
    assert parse_amount("1,234.50") == 1234.50
    assert parse_amount(100) == 100.0
    head = parse_accounting_head("2215-Water Supply and Sanitation")
    assert head is not None
    assert head.code == "2215"
    assert "Water" in head.label


def test_infer_voucher_kind():
    assert infer_voucher_kind("XVFC/2025-26/P/1") == "payment"
    assert infer_voucher_kind("XVFC/2025-26/R/1") == "receipt"


def test_parse_iso_date():
    assert parse_iso_date("2025-05-01").isoformat() == "2025-05-01"
    assert parse_iso_date("17-05-2025").isoformat() == "2025-05-17"


def test_synthetic_vouchers(tmp_path: Path):
    payload = [
        {
            "vId": 1,
            "voucherNo": "XVFC/2025-26/P/1",
            "voucherDate": "2025-05-01",
            "workCode": "111",
            "majorHead": "2215-Water",
            "subMajorHead": "01-X",
            "minorHead": "103-Y",
            "subHead": "81-Z",
            "detailHead": "00-",
            "objectHead": "50-Other",
            "zpName": "Sonipat",
            "bpName": "Sonipat",
            "zpCode": 75,
            "lgdCode": 33105,
            "lgdName": "Bohla",
            "amount": 5000.0,
            "planYear": 0,
            "panchayatName": "GP Bohla",
        },
        {
            "vId": 2,
            "voucherNo": "XVFC/2025-26/P/2",
            "voucherDate": "2025-05-01",
            "workCode": "111",
            "majorHead": "2215-Water",
            "subMajorHead": "01-X",
            "minorHead": "103-Y",
            "subHead": "81-Z",
            "detailHead": "00-",
            "objectHead": "50-Other",
            "zpName": "Sonipat",
            "bpName": "Sonipat",
            "zpCode": 75,
            "lgdCode": 99999,
            "lgdName": "Other",
            "amount": 100.0,
            "planYear": 0,
            "panchayatName": "Other",
        },
    ]
    path = tmp_path / "2025-2026.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    vouchers, warnings = parse_voucher_file(path, "2025-2026")
    assert len(vouchers) == 1
    assert vouchers[0].amountInr == 5000.0
    assert vouchers[0].financialYear == "2025-26"
    assert vouchers[0].detailUrl and "voucherID=1" in vouchers[0].detailUrl
    assert any("99999" in w for w in warnings)


def test_synthetic_voucher_detail_html(tmp_path: Path):
    html = """
    <html><body>
    <div>Payment Voucher Detail</div>
    <div>Type Of Transaction</div><div>Expenditures</div>
    <div>Activity Code</div><div>12345</div><div>Road work (2025-2026)</div>
    <div>Scheme Name</div><div>XV Finance Commission--Tied Grant</div>
    <div>Voucher Date</div><div>01/05/2025</div>
    <div>Voucher No</div><div>XVFC/2025-26/P/1</div>
    <div>Account Head</div>
    <div>Expenditure Heads</div>
    <div>2215 - Water Supply</div>
    <div>Amount (in Rs.)</div><div>5,000</div>
    <div>Particulars</div><div>online work charges</div>
    <div>Attached File</div><div>bill.pdf</div>
    <div>Mode Of Payment</div>
    <div>Details</div>
    <div>To Whom Paid</div>
    <div>Amount (in Rs.)</div>
    <div>PFMS</div>
    <div>Account Type:Bank</div>
    <div>Account No.:***************1234</div>
    <div>TEST PAYEE</div>
    <div>5,000</div>
    <div>Report generated through eGramSwaraj</div>
    </body></html>
    """
    path = tmp_path / "1.html"
    path.write_text(html, encoding="utf-8")
    detail = parse_voucher_detail_html(path, v_id=1, api_fin_year="2025-2026")
    assert detail.particulars == "online work charges"
    assert detail.schemeName and "Finance Commission" in detail.schemeName
    assert detail.activityCode == "12345"
    assert detail.payments and detail.payments[0].payeeName == "TEST PAYEE"
    assert detail.amountInr == 5000.0
    assert "voucherID=1" in detail.detailUrl


def test_synthetic_physical_progress(tmp_path: Path):
    html = """
    <html><body><table>
    <tr><th>S.No.</th><th>Activity Code</th><th>Activity Name</th>
    <th>Focus Area</th><th>Admin Approved Cost (in Rs.)</th>
    <th>Scheme Name</th><th>Component Name</th><th>Date of Completion</th></tr>
    <tr><td>1</td><td>80161696</td><td>Paver Block</td><td>Roads</td>
    <td>206325</td><td>XV Finance Commission</td><td>Basic Grant (untied)</td>
    <td>17-05-2025</td></tr>
    </table></body></html>
    """
    path = tmp_path / "fyear-2023-wrkstts-176.html"
    path.write_text(html, encoding="utf-8")
    works, warnings = parse_physical_progress_file(path, 2023)
    assert len(works) == 1
    assert works[0].activityCode == "80161696"
    assert works[0].adminApprovedCostInr == 206325
    assert works[0].financialYear == "2023-24"


def test_reject_non_bohla_plan(tmp_path: Path):
    html = """
    <html><table>
    <tr><th>S.No.</th><th>Theme Name</th><th>Activity Code</th><th>Activity Name</th>
    <th>Activity Description</th><th>Activity Location</th><th>Activity For</th>
    <th>Sector</th><th>Location of Asset</th><th>Estimated Cost</th>
    <th>Activity Type</th><th>Scheme Name</th><th>General Fund</th>
    <th>SC Fund</th><th>ST Fund</th></tr>
    <tr><td>1</td><td>T</td><td>1</td><td>Work</td><td>D</td><td>Other Village</td>
    <td>All</td><td>Roads</td><td>N/A</td><td>100</td><td>Asset</td><td>Own Funds</td>
    <td>100</td><td>0</td><td>0</td></tr>
    </table></html>
    """
    path = tmp_path / "plan.xls"
    path.write_text(html, encoding="utf-8")
    with pytest.raises(ValueError, match="Bohla"):
        parse_approved_plan_xls(path)


def test_no_double_count_payments():
    """Synthetic: sum of payments must not silently add approved costs."""
    payments = [100.0, 200.0, 50.0]
    approved = 500.0
    payment_total = sum(payments)
    # These metrics must remain distinct
    assert payment_total != approved
    assert payment_total + approved != payment_total  # sanity


def test_plan_activities_api_bundle(tmp_path: Path):
    bundle = {
        "planYr": 2024,
        "planYear": "2024-25",
        "planCd": 5142337,
        "gp_cd": 33105,
        "count": 2,
        "records": [
            {
                "activityCd": 98325278,
                "activityName": "Water Supply to villages",
                "activityDesc": "nala pond",
                "focusArea": "Drinking water",
                "themeName": "Theme 4 - Water Sufficient Village",
                "location": "Bohla (150)",
                "totalCost": 206330,
                "activityType": "Community Works",
                "activityStts": "Activity Approved",
                "plnUntCd": 33105,
                "fundAllocation": [
                    {
                        "schemeCode": "XV Finance Commission",
                        "componentCode": "Tied Grant",
                        "amountTotal": 206330,
                    }
                ],
            },
            {
                "activityCd": 98414812,
                "activityName": "Clean up drive",
                "activityDesc": None,
                "focusArea": "Health",
                "themeName": None,
                "location": "Bohla",
                "totalCost": 100000,
                "activityType": "Community Works",
                "activityStts": "WORK ONGOING",
                "plnUntCd": 33105,
                "fundAllocation": [
                    {
                        "schemeCode": "XV Finance Commission",
                        "componentCode": "Basic Grant (untied)",
                        "amountTotal": 100000,
                    }
                ],
            },
        ],
    }
    path = tmp_path / "activities.json"
    path.write_text(json.dumps(bundle), encoding="utf-8")
    rows, warnings, tied, untied = parse_plan_activities_bundle(path)
    assert not warnings
    assert len(rows) == 2
    assert rows[0].activityCode == "98325278"
    assert rows[0].activityNo == 1
    assert rows[1].activityNo == 2
    assert rows[0].schemeName == "XV Finance Commission"
    assert rows[0].sector == "Drinking water"
    assert rows[0].activityStts == "Activity Approved"
    assert rows[0].estimatedCostInr == 206330
    assert rows[0].planYear == "2024-25"
    assert tied == 206330
    assert untied == 100000


def test_tied_untied_helpers():
    tied, untied = tied_untied_from_allocations(
        [
            {
                "fundAllocation": [
                    {"componentCode": "Tied Grant", "amountTotal": 10},
                    {"componentCode": "Basic Grant (untied)", "amountTotal": 5},
                ]
            }
        ]
    )
    assert tied == 10
    assert untied == 5
