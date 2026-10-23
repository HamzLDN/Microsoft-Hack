"""Pure maths on price history. history rows are [date, close, dividend]."""
import math
from typing import List, Optional, Sequence

TRADING_DAYS = 252
BAD_YEAR_Z = 1.65  # roughly a 1 in 20 bad year


def closes(hist: Sequence) -> List[float]:
    return [row[1] for row in hist]


def daily_returns(c: Sequence[float]) -> List[float]:
    return [c[i] / c[i - 1] - 1 for i in range(1, len(c)) if c[i - 1]]


def total_return(c: Sequence[float], days: int = TRADING_DAYS) -> Optional[float]:
    if len(c) < 2:
        return None
    start = c[-min(days + 1, len(c))]
    return (c[-1] / start - 1) * 100


def volatility(c: Sequence[float], days: int = TRADING_DAYS) -> Optional[float]:
    r = daily_returns(c[-(days + 1):])
    if len(r) < 20:
        return None
    mean = sum(r) / len(r)
    var = sum((x - mean) ** 2 for x in r) / (len(r) - 1)
    return math.sqrt(var) * math.sqrt(TRADING_DAYS) * 100


def max_drawdown(c: Sequence[float], days: int = TRADING_DAYS) -> Optional[float]:
    window = c[-(days + 1):]
    if len(window) < 2:
        return None
    peak, worst = window[0], 0.0
    for p in window:
        peak = max(peak, p)
        worst = min(worst, p / peak - 1)
    return worst * 100


def dividend_yield(hist: Sequence, days: int = TRADING_DAYS) -> Optional[float]:
    if not hist:
        return None
    paid = sum(row[2] for row in hist[-days:])
    return paid / hist[-1][1] * 100 if hist[-1][1] else None


def bad_year_loss(vol_pct: float, amount: float) -> float:
    return BAD_YEAR_Z * vol_pct / 100 * amount


def typical_range(vol_pct: float, amount: float, expected_pct: float = 5.0):
    return (round((expected_pct - vol_pct) / 100 * amount), round((expected_pct + vol_pct) / 100 * amount))


def stock_share(horizon: float, risk: float) -> float:
    """Starting share of stocks, in percent, before the bad year loss limit is applied."""
    return max(20.0, min(90.0, 20 + 6 * horizon + 4 * (risk - 5)))


RANGES = {"1W": 5, "1M": 21, "6M": 126, "1Y": 252, "5Y": 1260}


def slice_range(hist: Sequence, rng: str):
    rows = hist[-(RANGES.get(rng, 252) + 1):]
    step = 5 if rng == "5Y" else 1
    out = [[r[0], r[1]] for r in rows[::step]]
    if rows and out[-1][0] != rows[-1][0]:
        out.append([rows[-1][0], rows[-1][1]])
    return out
