"""Extract Plan Summary tied/untied totals from Approved Action Plan PDFs."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path


def _pdftotext(path: Path) -> str:
    binary = shutil.which("pdftotext")
    if not binary:
        raise ValueError("pdftotext not found (install poppler)")
    result = subprocess.run(
        [binary, "-layout", str(path), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout or ""


def parse_plan_summary_tied_untied(pdf_path: Path) -> tuple[float, float]:
    """
    Return (tiedInr, untiedInr) from SECTION 1 Plan Summary
    “Total Planned Outlay” totals (preferred) or “Total Amount Allotted”.

    PDF layout places Tied Total then Untied Total for Allotted, then again
    for Planned Outlay — eight totals on the first numeric row under the headers.
    We take Planned Outlay pair (5th and 8th totals among the eight “Total” columns),
    falling back to Allotted (1st and 4th) if needed.
    """
    text = _pdftotext(pdf_path)
    # Focus on Plan Summary block before Sectoral View
    m = re.search(
        r"SECTION\s*1\s*:\s*Plan Summary(.*?)(?:SECTION\s*2|$)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    block = m.group(1) if m else text

    # Collect dense numeric rows (the summary value row)
    number_rows: list[list[float]] = []
    for line in block.splitlines():
        nums = [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*", line)]
        # Summary row has many cells (SC/ST/General/Total × 4 blocks)
        if len(nums) >= 8:
            number_rows.append(nums)

    if not number_rows:
        raise ValueError(f"No Plan Summary totals found in {pdf_path.name}")

    nums = number_rows[0]
    # Prefer Planned Outlay totals: indices for Total columns when layout is
    # [Tied SC,ST,Gen,Total, Untied SC,ST,Gen,Total, Tied..., Untied...]
    # When exactly 8 totals-like values exist as 16 numbers, take 4th & 8th of second half.
    if len(nums) >= 16:
        tied = nums[11]  # Planned Outlay Tied Total (0-based: SC ST Gen Total → index 11)
        untied = nums[15]
    elif len(nums) >= 8:
        # Sometimes only Allotted block is on the first row
        tied = nums[3]
        untied = nums[7]
    else:
        raise ValueError(f"Unexpected Plan Summary shape in {pdf_path.name}: {nums}")

    if tied + untied <= 0:
        raise ValueError(f"Zero tied+untied in {pdf_path.name}")
    return tied, untied
