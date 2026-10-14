"""Command-line interface for the import pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Import and normalize Bohla eGramSwaraj reports into public/data JSON"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="Run full import pipeline")
    run_p.add_argument(
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

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
