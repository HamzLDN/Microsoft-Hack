"""Builds one snapshot per ticker from all sources, choosing the best available source per metric."""
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import universe
from adapters import edgar, finnhub, fred, yf
from engine import metrics as M


def _m(value, source, as_of):
    return None if value is None else {"value": round(float(value), 2), "source": source, "asOf": as_of}


def _sec_growth_and_fcf(sec: dict):
    rev = sec.get("revenue") or []
    growth = fcf = None
    if len(rev) >= 2 and rev[1][1]:
        growth = (rev[0][1] / rev[1][1] - 1) * 100, rev[0][0]
    ocf, capex = dict(sec.get("ocf") or []), dict(sec.get("capex") or [])
    if rev and rev[0][0] in ocf and rev[0][1]:
        fcf = (ocf[rev[0][0]] - capex.get(rev[0][0], 0)) / rev[0][1] * 100, rev[0][0]
    return growth, fcf


def snapshot(t: str) -> Optional[dict]:
    meta = universe.ALL[t]
    hist, stale = yf.history(t)
    if not hist:
        return None
    c, last_date = M.closes(hist), hist[-1][0]
    q, q_stale = finnhub.quote(t)
    fhm, _ = finnhub.metrics(t)
    info, _ = yf.info(t)
    fhm, info = fhm or {}, info or {}
    sec = edgar.fundamentals(t)[0] if meta["type"] == "stock" else None

    m = {
        "price": _m(q["c"], "Finnhub", "live") if q else _m(c[-1], "yfinance", last_date),
        "ret1y": _m(M.total_return(c), "yfinance", last_date),
        "vol": _m(M.volatility(c), "yfinance", last_date),
        "dd": _m(M.max_drawdown(c), "yfinance", last_date),
        "divYield": _m(M.dividend_yield(hist), "yfinance", last_date),
        "beta": _m(fhm.get("beta"), "Finnhub", "latest") or _m(info.get("beta"), "yfinance", "latest"),
        "pe": _m(fhm.get("peTTM") or fhm.get("peBasicExclExtraTTM"), "Finnhub", "TTM") or _m(info.get("trailingPE"), "yfinance", "TTM"),
        "grossMargin": _m(fhm.get("grossMarginTTM"), "Finnhub", "TTM")
                       or _m(info["grossMargins"] * 100 if info.get("grossMargins") is not None else None, "yfinance", "TTM"),
        "debtToEquity": _m(fhm.get("totalDebt/totalEquityAnnual"), "Finnhub", "annual"),
    }
    mcap = fhm.get("marketCapitalization")
    m["mcap"] = _m(mcap / 1000, "Finnhub", "latest") if mcap else _m(info["marketCap"] / 1e9 if info.get("marketCap") else None, "yfinance", "latest")

    growth, fcf = _sec_growth_and_fcf(sec) if sec else (None, None)
    m["revGrowth"] = _m(growth[0], "SEC EDGAR", growth[1]) if growth else (
        _m(fhm.get("revenueGrowthTTMYoy"), "Finnhub", "TTM")
        or _m(info["revenueGrowth"] * 100 if info.get("revenueGrowth") is not None else None, "yfinance", "latest quarter"))
    fcf_info = info["freeCashflow"] / info["totalRevenue"] * 100 if info.get("freeCashflow") and info.get("totalRevenue") else None
    m["fcfMargin"] = _m(fcf[0], "SEC EDGAR", fcf[1]) if fcf else _m(fcf_info, "yfinance", "TTM")
    if meta["type"] == "etf":  # company ratios like P/E are meaningless for funds
        for k in ("pe", "revGrowth", "fcfMargin", "grossMargin", "debtToEquity"):
            m[k] = None
    m = {k: v for k, v in m.items() if v is not None}

    news = finnhub.news(t)[0] or yf.news(t)[0] or []
    tags, themes = list(meta["tags"]), list(meta["themes"])
    if meta["type"] == "stock":
        if "fcfMargin" in m and m["fcfMargin"]["value"] < 0:
            tags.append("Unprofitable")
        if m["price"]["value"] < 5:
            tags.append("Penny stocks")
        if "debtToEquity" in m and m["debtToEquity"]["value"] > 2:
            tags.append("High debt")
    if m.get("divYield", {}).get("value", 0) >= 2 and "Dividend payers" not in themes:
        themes.append("Dividend payers")

    return {**meta, "name": meta["name"], "themes": themes, "tags": tags, "metrics": m, "news": news,
            "secUrl": sec.get("url") if sec else None, "stale": bool(stale or q_stale), "history": hist}


def snapshots(tickers: List[str], workers: int = 8) -> Dict[str, dict]:
    with ThreadPoolExecutor(workers) as pool:
        out = dict(zip(tickers, pool.map(snapshot, tickers)))
    return {t: s for t, s in out.items() if s}


def macro():
    return fred.macro()[0]
