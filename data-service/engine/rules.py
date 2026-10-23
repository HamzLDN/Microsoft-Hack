"""Checks one rule against one company. Portfolio level rules (horizon, loss limit, max per holding) always pass here."""
from typing import Tuple

PORTFOLIO_FIELDS = {"horizon_years", "max_bad_year_loss", "max_holding_pct", "note"}


def _norm(x) -> set:
    items = x if isinstance(x, (list, tuple, set)) else [x]
    return {str(i).strip().lower() for i in items if i is not None}


def _metric(snap, key):
    m = snap["metrics"].get(key)
    return None if m is None else m["value"]


def check(rule: dict, snap: dict) -> Tuple[bool, str]:
    f, v = rule.get("field"), rule.get("value")
    if f in PORTFOLIO_FIELDS:
        return True, "Applied to the whole portfolio"
    if f == "exclude_tag":
        hit = _norm(snap.get("tags", [])) & _norm(v)
        return (False, f"Involved in: {', '.join(sorted(hit)).capitalize()}") if hit else (True, "None of the excluded activities")
    if f == "favour_sector":
        hit = _norm(snap.get("themes", [])) & _norm(v)
        return (True, f"In a favoured area: {', '.join(sorted(hit)).capitalize()}") if hit else (False, "Not in a favoured area")
    if f == "min_dividend_yield":
        y = _metric(snap, "divYield")
        if y is None:
            return False, "No dividend data"
        return (y >= float(v), f"Dividend yield {y:.2f}% against your minimum {float(v):.2f}%")
    if f == "profitable":
        fcf = _metric(snap, "fcfMargin")
        if fcf is None:
            return (snap.get("type") == "etf", "Fund, profitability not applicable" if snap.get("type") == "etf" else "No cash flow data")
        return (fcf > 0, f"Free cash flow margin {fcf:.1f}%")
    if f == "max_volatility":
        vol = _metric(snap, "vol")
        if vol is None:
            return False, "No volatility data"
        return (vol <= float(v), f"Volatility {vol:.1f}% against your limit {float(v):.0f}%")
    return True, "Not checked automatically"


def soft_points(rule: dict, passed: bool) -> float:
    if rule.get("field") == "favour_sector":
        return 8.0 if passed else 0.0
    return 6.0 if passed else -4.0
