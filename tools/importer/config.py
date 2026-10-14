"""Bohla GP constants and year mappings for eGramSwaraj fetch/import."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BohlaGeo:
    """LGD / planning geography for Gram Panchayat Bohla."""

    lgd_code: int = 33105
    state_cd: int = 6
    zp_cd: int = 75
    bp_cd: int = 1142
    # Village panchayat list in getPlanVpData
    typ_cd: int = 3
    level: int = 3
    # Physical progress completed filter
    wrkstts_completed: int = 176


BOHLA = BohlaGeo()

BASE_URL = "https://egramswaraj.gov.in"

# Calendar plan year / physical-progress fyear → portal FY label
PLAN_YR_TO_CANONICAL: dict[int, str] = {
    2020: "2020-21",
    2021: "2021-22",
    2022: "2022-23",
    2023: "2023-24",
    2024: "2024-25",
    2025: "2025-26",
    2026: "2026-27",
}

# Voucher API finYear → portal FY
VOUCHER_API_FY: dict[int, str] = {
    2020: "2020-2021",
    2021: "2021-2022",
    2022: "2022-2023",
    2023: "2023-2024",
    2024: "2024-2025",
    2025: "2025-2026",
    2026: "2026-2027",
}

DEFAULT_PLAN_YR_FROM = 2020
DEFAULT_PLAN_YR_TO = 2026


def plan_yr_to_canonical(plan_yr: int) -> str:
    if plan_yr in PLAN_YR_TO_CANONICAL:
        return PLAN_YR_TO_CANONICAL[plan_yr]
    return f"{plan_yr}-{str(plan_yr + 1)[2:]}"


def voucher_api_fy(plan_yr: int) -> str:
    if plan_yr in VOUCHER_API_FY:
        return VOUCHER_API_FY[plan_yr]
    return f"{plan_yr}-{plan_yr + 1}"


def iter_plan_years(from_yr: int, to_yr: int) -> list[int]:
    if from_yr > to_yr:
        raise ValueError(f"from_yr {from_yr} > to_yr {to_yr}")
    return list(range(from_yr, to_yr + 1))
