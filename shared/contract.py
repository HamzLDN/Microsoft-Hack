"""Shared data contract. Mirrors shared/contract.ts. Change both together.

Plain dicts go over the wire; these TypedDicts document the shapes.
"""
from __future__ import annotations

from typing import Any, List, Literal, Optional, Tuple, TypedDict


class Evidence(TypedDict, total=False):
    id: str
    ticker: str
    label: str
    value: float
    unit: Literal["%", "$", "x", "count", "years"]
    source: Literal["Finnhub", "yfinance", "SEC EDGAR", "FRED", "Engine"]
    asOf: str
    url: Optional[str]


class Rule(TypedDict, total=False):
    id: str
    text: str
    kind: Literal["hard", "soft"]
    field: str  # horizon_years | max_bad_year_loss | exclude_tag | favour_sector | min_dividend_yield | profitable | max_holding_pct | max_volatility | note
    op: Literal["<=", ">=", "==", "in", "not_in"]
    value: Any
    source: Literal["form", "text"]
    quote: Optional[str]
    kindReason: str
    confidence: float


class ScorePart(TypedDict):
    name: Literal["Growth", "Profitability", "Stability", "Income", "Valuation", "News"]
    weight: float
    value: float
    evidenceIds: List[str]


class ScoreBreakdown(TypedDict):
    total: float
    parts: List[ScorePart]
    ruleAdjustments: List[dict]  # {"ruleId": str, "points": float}


class Point(TypedDict, total=False):
    text: str
    evidenceIds: List[str]
    ruleId: Optional[str]


class Candidate(TypedDict, total=False):
    ticker: str
    name: str
    sector: str
    type: Literal["stock", "etf"]
    status: Literal["included", "excluded"]
    amount: float
    score: ScoreBreakdown
    pros: List[Point]
    cons: List[Point]
    checks: List[dict]  # {"ruleId": str, "pass": bool, "detail": str}
    mainReason: str
    whatWouldGetItIn: Optional[str]


class Portfolio(TypedDict):
    split: dict  # {"stocks": float, "bonds": float, "cash": float}
    holdings: List[Candidate]
    considered: List[Candidate]
    badYearLoss: float
    typicalRange: Tuple[float, float]
    ruleSummary: List[dict]  # {"ruleId": str, "status": str}
