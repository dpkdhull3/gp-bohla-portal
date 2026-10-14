"""Orchestrate import → normalize → write public/data JSON."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from .models.schemas import (
    CoverageItem,
    CoverageStatus,
    DataQualityFlag,
    ImportSummary,
    Panchayat,
    PortalMeta,
    SchemeRollup,
)
from .parsers.approved_plan import parse_approved_plan_xls
from .parsers.physical_progress import parse_physical_progress_file
from .parsers.vouchers import parse_voucher_file

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "reports" / "raw"
OUT = ROOT / "web" / "public" / "data"

VOUCHER_YEARS = [
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
    "2025-2026",
    "2026-2027",
]
PHYS_FYEARS = [2021, 2022, 2023, 2024, 2025, 2026]


def _json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    raise TypeError(f"Not serializable: {type(obj)}")


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=_json_default) + "\n",
        encoding="utf-8",
    )


def run_import(out_dir: Path | None = None) -> ImportSummary:
    out = out_dir or OUT
    out.mkdir(parents=True, exist_ok=True)

    files_processed: list[str] = []
    files_rejected: list[str] = []
    duplicate_rows: list[str] = []
    missing_values: list[str] = []
    reconciliation_notes: list[str] = []
    rows_imported: dict[str, int] = {}
    all_warnings: list[str] = []

    # --- Vouchers ---
    all_vouchers = []
    for api_fy in VOUCHER_YEARS:
        path = RAW / "vouchers" / f"{api_fy}.json"
        if not path.exists():
            files_rejected.append(str(path))
            continue
        vouchers, warnings = parse_voucher_file(path, api_fy)
        all_warnings.extend(warnings)
        for w in warnings:
            if "duplicate" in w.lower():
                duplicate_rows.append(w)
            if "malformed" in w.lower() or "missing" in w.lower():
                missing_values.append(w)
        files_processed.append(str(path.relative_to(ROOT)))
        all_vouchers.extend(vouchers)

    rows_imported["vouchers"] = len(all_vouchers)
    _write_json(
        out / "vouchers" / "index.json",
        {
            "years": sorted({v.financialYear for v in all_vouchers}),
            "totalCount": len(all_vouchers),
            "totalPaymentInr": sum(
                v.amountInr for v in all_vouchers if v.voucherKind == "payment"
            ),
        },
    )

    # --- Works ---
    all_works = []
    for fyear in PHYS_FYEARS:
        path = RAW / "physical-progress" / f"fyear-{fyear}-wrkstts-176.html"
        if not path.exists():
            files_rejected.append(str(path))
            continue
        works, warnings = parse_physical_progress_file(path, fyear)
        all_warnings.extend(warnings)
        files_processed.append(str(path.relative_to(ROOT)))
        all_works.extend(works)
        from .parsers.common import FYEAR_TO_CANONICAL

        canon_fy = FYEAR_TO_CANONICAL[fyear]
        _write_json(
            out / "works" / f"{canon_fy}.json",
            {
                "financialYear": canon_fy,
                "statusFilter": "wrkstts=176",
                "statusLabel": "completed_as_recorded",
                "count": len(works),
                "records": [w.model_dump(mode="json") for w in works],
            },
        )

    # Link vouchers ↔ works
    payments_by_work: dict[str, list] = defaultdict(list)
    for v in all_vouchers:
        if v.workCode:
            payments_by_work[v.workCode].append(v)

    work_codes = {w.activityCode for w in all_works}
    for w in all_works:
        linked = payments_by_work.get(w.activityCode, [])
        w.linkedVoucherCount = len(linked)
        w.linkedVoucherSumInr = sum(v.amountInr for v in linked) if linked else 0.0
        if not linked:
            w.flags.append(DataQualityFlag.NO_LINKED_VOUCHERS)
            reconciliation_notes.append(
                f"Work {w.activityCode} has no matching payment vouchers"
            )
        elif w.adminApprovedCostInr is not None:
            variance = (w.linkedVoucherSumInr or 0) - w.adminApprovedCostInr
            reconciliation_notes.append(
                f"Work {w.activityCode}: approved={w.adminApprovedCostInr}, "
                f"voucherSum={w.linkedVoucherSumInr}, variance={variance}"
            )

    for code, vs in payments_by_work.items():
        if code not in work_codes:
            for v in vs:
                if DataQualityFlag.UNMATCHED_WORK not in v.flags:
                    v.flags.append(DataQualityFlag.UNMATCHED_WORK)
            reconciliation_notes.append(
                f"Voucher workCode {code} has no completed-works row (wrkstts=176)"
            )

    # Rewrite works with linkage
    works_by_fy: dict[str, list] = defaultdict(list)
    for w in all_works:
        works_by_fy[w.financialYear].append(w)
    for fy, works in works_by_fy.items():
        _write_json(
            out / "works" / f"{fy}.json",
            {
                "financialYear": fy,
                "statusFilter": "wrkstts=176",
                "statusLabel": "completed_as_recorded",
                "count": len(works),
                "records": [w.model_dump(mode="json") for w in works],
            },
        )

    rows_imported["works"] = len(all_works)
    _write_json(
        out / "works" / "index.json",
        {
            "years": sorted(works_by_fy.keys()),
            "totalCount": len(all_works),
            "totalAdminApprovedInr": sum(
                w.adminApprovedCostInr or 0 for w in all_works
            ),
        },
    )

    # Rewrite vouchers with unmatched flags
    vouchers_by_fy: dict[str, list] = defaultdict(list)
    for v in all_vouchers:
        vouchers_by_fy[v.financialYear].append(v)
    for fy, vouchers in vouchers_by_fy.items():
        _write_json(
            out / "vouchers" / f"{fy}.json",
            {
                "financialYear": fy,
                "count": len(vouchers),
                "totalPaymentInr": sum(
                    v.amountInr for v in vouchers if v.voucherKind == "payment"
                ),
                "records": [v.model_dump(mode="json") for v in vouchers],
            },
        )

    # --- Approved plans (year-wise folder: reports/Approved action plans/{fy}/) ---
    import shutil

    plans_src_root = ROOT / "reports" / "Approved action plans"
    plans_public = ROOT / "web" / "public" / "reports" / "approved-action-plans"
    plans_public.mkdir(parents=True, exist_ok=True)
    planned = []
    plan_years_imported: list[str] = []
    plan_index_rows: list[dict[str, Any]] = []

    year_dirs = sorted(
        d for d in plans_src_root.iterdir() if d.is_dir() and not d.name.startswith(".")
    ) if plans_src_root.exists() else []

    for year_dir in year_dirs:
        fy = year_dir.name
        xls = year_dir / "approved_action_plan_report.xls"
        pdf = year_dir / f"{fy}.pdf"
        if not xls.exists():
            files_rejected.append(f"{year_dir}: missing approved_action_plan_report.xls")
            continue
        try:
            rows, warnings = parse_approved_plan_xls(xls, fy)
            all_warnings.extend(warnings)
            files_processed.append(str(xls.relative_to(ROOT)))
            planned.extend(rows)
            plan_years_imported.append(fy)
            pdf_public_path = f"/reports/approved-action-plans/{fy}.pdf"
            xls_public_path = f"/reports/approved-action-plans/{fy}.xls"
            shutil.copy2(xls, plans_public / f"{fy}.xls")
            if pdf.exists():
                shutil.copy2(pdf, plans_public / f"{fy}.pdf")
                files_processed.append(str(pdf.relative_to(ROOT)))
            else:
                pdf_public_path = ""
                all_warnings.append(f"{fy}: PDF missing beside spreadsheet")
            total = sum(a.estimatedCostInr or 0 for a in rows)
            payload = {
                "planYear": fy,
                "count": len(rows),
                "totalEstimatedCostInr": total,
                "pdfPath": pdf_public_path or None,
                "xlsPath": xls_public_path,
                "records": [a.model_dump(mode="json") for a in rows],
            }
            _write_json(out / "plans" / f"{fy}.json", payload)
            plan_index_rows.append(
                {
                    "planYear": fy,
                    "count": len(rows),
                    "totalEstimatedCostInr": total,
                    "pdfPath": pdf_public_path or None,
                    "xlsPath": xls_public_path,
                }
            )
        except ValueError as exc:
            files_rejected.append(f"{xls}: {exc}")

    # Fallback: legacy single-year raw path if folder import found nothing
    if not planned:
        plan_path = RAW / "approved-action-plan" / "2026-27-ApprovedActionPlan.xls"
        if plan_path.exists():
            try:
                planned, warnings = parse_approved_plan_xls(plan_path, "2026-27")
                all_warnings.extend(warnings)
                files_processed.append(str(plan_path.relative_to(ROOT)))
                plan_years_imported.append("2026-27")
                _write_json(
                    out / "plans" / "2026-27.json",
                    {
                        "planYear": "2026-27",
                        "count": len(planned),
                        "totalEstimatedCostInr": sum(
                            a.estimatedCostInr or 0 for a in planned
                        ),
                        "pdfPath": "/reports/raw/approved-action-plan/2026-27-ApprovedAction.pdf",
                        "records": [a.model_dump(mode="json") for a in planned],
                    },
                )
                plan_index_rows.append(
                    {
                        "planYear": "2026-27",
                        "count": len(planned),
                        "totalEstimatedCostInr": sum(
                            a.estimatedCostInr or 0 for a in planned
                        ),
                        "pdfPath": "/reports/raw/approved-action-plan/2026-27-ApprovedAction.pdf",
                    }
                )
            except ValueError as exc:
                files_rejected.append(f"{plan_path}: {exc}")
        else:
            files_rejected.append(str(plan_path))

    rows_imported["plannedActivities"] = len(planned)
    plan_index_rows.sort(key=lambda r: r["planYear"], reverse=True)
    _write_json(
        out / "plans" / "index.json",
        {
            "years": [r["planYear"] for r in plan_index_rows],
            "plans": plan_index_rows,
            "noteEn": "Approved action plans imported from eGramSwaraj spreadsheets + PDFs.",
            "noteHi": "स्वीकृत कार्य योजनाएँ ईग्रामस्वराज स्प्रेडशीट और PDF से आयात हुईं।",
        },
    )

    # --- Schemes rollup ---
    scheme_map: dict[str, SchemeRollup] = {}

    def ensure_scheme(name: str) -> SchemeRollup:
        if name not in scheme_map:
            scheme_map[name] = SchemeRollup(
                schemeName=name,
                financialYears=[],
                flags=[DataQualityFlag.DERIVED],
            )
        return scheme_map[name]

    for v in all_vouchers:
        name = v.schemeHint or "Unspecified / from voucher prefix"
        s = ensure_scheme(name)
        if v.financialYear not in s.financialYears:
            s.financialYears.append(v.financialYear)
        if v.voucherKind == "payment":
            s.recordedPaymentInr += v.amountInr

    for w in all_works:
        name = w.schemeName or "Unspecified"
        s = ensure_scheme(name)
        if w.financialYear not in s.financialYears:
            s.financialYears.append(w.financialYear)
        s.completedWorksCount += 1

    for a in planned:
        name = a.schemeName or "Unspecified"
        s = ensure_scheme(name)
        if a.planYear not in s.financialYears:
            s.financialYears.append(a.planYear)
        s.plannedActivitiesCount += 1
        s.plannedOutlayInr = (s.plannedOutlayInr or 0) + (a.estimatedCostInr or 0)

    schemes = sorted(scheme_map.values(), key=lambda x: x.schemeName)
    for s in schemes:
        s.financialYears = sorted(s.financialYears)

    _write_json(
        out / "schemes" / "index.json",
        {
            "count": len(schemes),
            "records": [s.model_dump(mode="json") for s in schemes],
        },
    )

    # --- Year summaries for funds page ---
    year_summaries = []
    all_years = sorted(
        set(vouchers_by_fy.keys())
        | set(works_by_fy.keys())
        | set(plan_years_imported)
        | {"2026-27"}
    )
    for fy in all_years:
        vs = vouchers_by_fy.get(fy, [])
        ws = works_by_fy.get(fy, [])
        year_summaries.append(
            {
                "financialYear": fy,
                "recordedPaymentInr": sum(
                    v.amountInr for v in vs if v.voucherKind == "payment"
                ),
                "recordedReceiptInr": sum(
                    v.amountInr for v in vs if v.voucherKind == "receipt"
                ),
                "voucherCount": len(vs),
                "completedWorksCount": len(ws),
                "adminApprovedWorksInr": sum(w.adminApprovedCostInr or 0 for w in ws),
                "openingBalanceInr": None,
                "closingBalanceInr": None,
                "fundsReceivedInr": None,
                "balanceCoverage": "missing",
                "notes": [
                    "Opening/closing balance and funds received are not available in imported voucher JSON.",
                    "Do not treat recorded payments as the full official expenditure statement.",
                ],
            }
        )
    _write_json(out / "finance" / "year-summaries.json", {"years": year_summaries})

    # --- Reconciliation ---
    _write_json(
        out / "reconciliation" / "summary.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "notes": reconciliation_notes,
            "warnings": all_warnings,
        },
    )

    # --- Downloads catalogue ---
    from .parsers.common import canonicalize_fy_api

    downloads = []
    for p in sorted((RAW / "vouchers").glob("*.json")):
        if p.name.endswith(".meta.json"):
            continue
        try:
            fy_label = canonicalize_fy_api(p.stem)
        except ValueError:
            fy_label = p.stem
        downloads.append(
            {
                "id": f"voucher-{p.stem}",
                "titleEn": f"GP Voucher Details {fy_label}",
                "titleHi": f"ग्राम पंचायत वाउचर विवरण {fy_label}",
                "category": "vouchers",
                "financialYear": fy_label,
                "kind": "original",
                "format": "json",
                "path": f"/reports/raw/vouchers/{p.name}",
                "source": "eGramSwaraj getGPVoucherDetailsData.do",
            }
        )

    for p in sorted((RAW / "physical-progress").glob("*.html")):
        fy = p.name.split("-")[1] if "fyear-" in p.name else "?"
        from .parsers.common import FYEAR_TO_CANONICAL

        canon = FYEAR_TO_CANONICAL.get(int(fy), fy)
        downloads.append(
            {
                "id": f"phys-{canon}",
                "titleEn": f"Physical Progress (completed filter) {canon}",
                "titleHi": f"भौतिक प्रगति (पूर्ण) {canon}",
                "category": "physical-progress",
                "financialYear": canon,
                "kind": "original",
                "format": "html",
                "path": f"/reports/raw/physical-progress/{p.name}",
                "source": "eGramSwaraj physicalprogressReport.do wrkstts=176",
            }
        )

    for row in plan_index_rows:
        fy = row["planYear"]
        if row.get("pdfPath"):
            downloads.append(
                {
                    "id": f"plan-{fy}-pdf",
                    "titleEn": f"Approved Action Plan {fy} (PDF)",
                    "titleHi": f"स्वीकृत कार्य योजना {fy} (PDF)",
                    "category": "approved-action-plan",
                    "financialYear": fy,
                    "kind": "original",
                    "format": "pdf",
                    "path": row["pdfPath"],
                    "source": "eGramSwaraj Approved Action Plan",
                }
            )
        downloads.append(
            {
                "id": f"plan-{fy}-xls",
                "titleEn": f"Approved Action Plan {fy} (XLS/HTML)",
                "titleHi": f"स्वीकृत कार्य योजना {fy} (XLS)",
                "category": "approved-action-plan",
                "financialYear": fy,
                "kind": "original",
                "format": "xls",
                "path": row.get("xlsPath")
                or f"/reports/approved-action-plans/{fy}.xls",
                "source": "eGramSwaraj Approved Action Plan",
            }
        )
    downloads.append(
        {
            "id": "generated-year-summaries",
            "titleEn": "Derived year-wise financial summaries (JSON)",
            "titleHi": "वर्षवार वित्तीय सारांश (व्युत्पन्न JSON)",
            "category": "generated",
            "financialYear": None,
            "kind": "derived",
            "format": "json",
            "path": "/data/finance/year-summaries.json",
            "source": "Portal import pipeline",
        }
    )
    _write_json(out / "downloads.json", {"records": downloads})

    # --- Meta / coverage ---
    payment_years = sorted(vouchers_by_fy.keys())
    work_years = sorted(works_by_fy.keys())
    available = sorted(
        set(payment_years) | set(work_years) | set(plan_years_imported) | {"2026-27"}
    )
    # Prefer 2025-26 for the public default when that year exists in the dataset.
    preferred_default = "2025-26"
    if preferred_default in available:
        default_fy = preferred_default
    elif payment_years:
        default_fy = payment_years[-1]
    else:
        default_fy = available[-1]

    coverage = [
        CoverageItem(
            metric="recorded_payments",
            status=CoverageStatus.AVAILABLE,
            noteEn="Payment vouchers from eGramSwaraj GP Voucher Details for Bohla (LGD 33105).",
            noteHi="ईग्रामस्वराज ग्राम पंचायत वाउचर विवरण से बोहला के भुगतान वाउचर।",
            financialYears=payment_years,
        ),
        CoverageItem(
            metric="funds_received",
            status=CoverageStatus.MISSING,
            noteEn="No receipt vouchers or cash-book statement imported yet. Do not infer receipts from payments.",
            noteHi="अभी कोई प्राप्ति वाउचर या कैश बुक आयात नहीं हुई। भुगतानों से प्राप्तियाँ न मानें।",
            financialYears=[],
        ),
        CoverageItem(
            metric="opening_closing_balance",
            status=CoverageStatus.MISSING,
            noteEn="Official opening/closing balances require Cash Book or Receipt & Expenditure reports.",
            noteHi="आधिकारिक प्रारंभिक/अंतिम शेष के लिए कैश बुक या प्राप्ति-व्यय रिपोर्ट आवश्यक है।",
            financialYears=[],
        ),
        CoverageItem(
            metric="completed_works",
            status=CoverageStatus.AVAILABLE,
            noteEn="Works listed under Physical Progress filter wrkstts=176 (completed as recorded).",
            noteHi="भौतिक प्रगति फ़िल्टर wrkstts=176 में सूचीबद्ध कार्य (रिकॉर्ड के अनुसार पूर्ण)।",
            financialYears=work_years,
        ),
        CoverageItem(
            metric="ongoing_pending_works",
            status=CoverageStatus.MISSING,
            noteEn="Other wrkstts codes returned empty tables for Bohla in the investigation pass; not claimed here.",
            noteHi="अन्य स्थिति कोड बोहला के लिए खाली मिले; यहाँ दावा नहीं किया गया।",
            financialYears=[],
        ),
        CoverageItem(
            metric="approved_action_plan",
            status=CoverageStatus.AVAILABLE if plan_years_imported else CoverageStatus.MISSING,
            noteEn=(
                f"Approved Action Plans imported for: {', '.join(sorted(plan_years_imported, reverse=True))}."
                if plan_years_imported
                else "No approved action plan imported yet."
            ),
            noteHi=(
                f"स्वीकृत कार्य योजना आयात: {', '.join(sorted(plan_years_imported, reverse=True))}।"
                if plan_years_imported
                else "अभी कोई स्वीकृत कार्य योजना आयात नहीं हुई।"
            ),
            financialYears=sorted(plan_years_imported),
        ),
        CoverageItem(
            metric="audit_reports",
            status=CoverageStatus.MISSING,
            noteEn="No Bohla AuditOnline reports in the reviewed local sources.",
            noteHi="समीक्षित स्रोतों में बोहला की ऑडिट रिपोर्ट उपलब्ध नहीं।",
            financialYears=[],
        ),
        CoverageItem(
            metric="assets_geotag",
            status=CoverageStatus.MISSING,
            noteEn="No geo-tagged asset extract imported yet.",
            noteHi="अभी कोई भू-टैग संपत्ति डेटा आयात नहीं हुआ।",
            financialYears=[],
        ),
    ]

    meta = PortalMeta(
        panchayat=Panchayat(),
        lastDataUpdate=datetime.now(timezone.utc).date().isoformat(),
        availableFinancialYears=available,
        defaultFinancialYear=default_fy,
        coverage=coverage,
        disclaimerEn=(
            "This is an independent public-information portal. It is not an official "
            "government website. Figures come from eGramSwaraj and related public records. "
            "Missing data is not proof of wrongdoing or of a clean record."
        ),
        disclaimerHi=(
            "यह एक स्वतंत्र जन-सूचना पोर्टल है। यह सरकारी वेबसाइट नहीं है। आँकड़े ईग्रामस्वराज "
            "और संबंधित सार्वजनिक अभिलेखों से हैं। अनुपलब्ध डेटा गलत आचरण या स्वच्छ रिकॉर्ड का प्रमाण नहीं है।"
        ),
        sources=[
            {
                "name": "eGramSwaraj GP Voucher Details",
                "url": "https://egramswaraj.gov.in/getGPVoucherDetailsData.do",
            },
            {
                "name": "eGramSwaraj Physical Progress Report",
                "url": "https://egramswaraj.gov.in/physicalprogressReport.do",
            },
            {
                "name": "eGramSwaraj Approved Action Plan",
                "url": "https://egramswaraj.gov.in/planningDashBoard.do",
            },
        ],
    )
    _write_json(out / "meta.json", meta.model_dump(mode="json"))

    # Copy raw reports into web/public for downloads
    public_reports = ROOT / "web" / "public" / "reports" / "raw"
    for sub in ("vouchers", "physical-progress", "approved-action-plan"):
        src = RAW / sub
        dst = public_reports / sub
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)


    summary = ImportSummary(
        generatedAt=datetime.now(timezone.utc),
        filesProcessed=files_processed,
        filesRejected=files_rejected,
        rowsImported=rows_imported,
        duplicateRows=duplicate_rows,
        missingValues=missing_values,
        reconciliationNotes=reconciliation_notes,
        yearsCovered=available,
        schemesCovered=[s.schemeName for s in schemes],
    )
    _write_json(out / "import-summary.json", summary.model_dump(mode="json"))
    return summary
