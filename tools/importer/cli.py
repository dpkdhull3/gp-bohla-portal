"""Command-line interface for the import pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from .config import DEFAULT_PLAN_YR_FROM, DEFAULT_PLAN_YR_TO


def _add_year_range_args(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--from",
        dest="from_yr",
        type=int,
        default=DEFAULT_PLAN_YR_FROM,
        help=f"First plan year (calendar, default {DEFAULT_PLAN_YR_FROM})",
    )
    p.add_argument(
        "--to",
        dest="to_yr",
        type=int,
        default=DEFAULT_PLAN_YR_TO,
        help=f"Last plan year (calendar, default {DEFAULT_PLAN_YR_TO})",
    )
    p.add_argument(
        "--skip-plans",
        action="store_true",
        help="Do not fetch plan activity APIs",
    )
    p.add_argument(
        "--skip-vouchers",
        action="store_true",
        help="Do not fetch voucher JSON",
    )
    p.add_argument(
        "--skip-voucher-details",
        action="store_true",
        help="Do not fetch per-voucher payment detail HTML",
    )
    p.add_argument(
        "--skip-physical-progress",
        action="store_true",
        help="Do not fetch physical progress HTML",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Import and normalize Bohla eGramSwaraj reports into public/data JSON"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Run full import pipeline from reports/raw")
    run_p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (default: web/public/data)",
    )

    fetch_p = sub.add_parser(
        "fetch",
        help="Download eGramSwaraj plan/voucher/progress data into reports/raw",
    )
    _add_year_range_args(fetch_p)

    far_p = sub.add_parser(
        "fetch-and-run",
        help="Fetch from eGramSwaraj then run the import pipeline",
    )
    _add_year_range_args(far_p)
    far_p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (default: web/public/data)",
    )

    args = parser.parse_args(argv)

    if args.command == "run":
        from .pipeline import run_import

        summary = run_import(out_dir=args.out)
        print(json.dumps(summary.model_dump(mode="json"), indent=2, default=str))
        print(
            f"\nOK: processed {len(summary.filesProcessed)} files, "
            f"imported {summary.rowsImported}"
        )
        return 0

    if args.command in ("fetch", "fetch-and-run"):
        from .fetch_egram import fetch_all

        result = fetch_all(
            from_yr=args.from_yr,
            to_yr=args.to_yr,
            plans=not args.skip_plans,
            vouchers=not args.skip_vouchers,
            voucher_details=not args.skip_voucher_details,
            physical_progress=not args.skip_physical_progress,
        )
        print(
            json.dumps(
                {
                    "filesWritten": result.files_written,
                    "planYears": result.plan_years,
                    "warnings": result.warnings,
                },
                indent=2,
            )
        )
        print(
            f"\nOK: wrote {len(result.files_written)} files "
            f"for plan years {result.plan_years}"
        )
        if result.warnings:
            print(f"Warnings ({len(result.warnings)}):", file=sys.stderr)
            for w in result.warnings:
                print(f"  - {w}", file=sys.stderr)

        if args.command == "fetch":
            return 0

        from .pipeline import run_import

        summary = run_import(out_dir=args.out)
        print(json.dumps(summary.model_dump(mode="json"), indent=2, default=str))
        print(
            f"\nOK: processed {len(summary.filesProcessed)} files, "
            f"imported {summary.rowsImported}"
        )
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
