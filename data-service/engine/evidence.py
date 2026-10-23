"""Evidence packs: every number an analyst may quote, with a stable id, source and date."""
from typing import List, Optional

from engine.score import sentiment

# Stable ids per metric, so "E3" always means volatility for every ticker.
FIELDS = [
    ("E1", "price", "Share price", "$"), ("E2", "ret1y", "Return over the last year", "%"),
    ("E3", "vol", "Volatility over the last year (annualised)", "%"), ("E4", "dd", "Largest fall from a peak in the last year", "%"),
    ("E5", "beta", "Beta (sensitivity to the market)", "x"), ("E6", "pe", "Price to earnings ratio", "x"),
    ("E7", "divYield", "Dividend yield", "%"), ("E8", "revGrowth", "Revenue growth, year on year", "%"),
    ("E9", "fcfMargin", "Free cash flow margin", "%"), ("E10", "grossMargin", "Gross margin", "%"),
    ("E11", "mcap", "Market value ($ billions)", "$"), ("E12", "debtToEquity", "Debt to equity", "x"),
]
METRIC_TO_ID = {key: eid for eid, key, _, _ in FIELDS}


def build(snap: dict, macro: Optional[dict] = None) -> List[dict]:
    t, out = snap["ticker"], []
    for eid, key, label, unit in FIELDS:
        m = snap["metrics"].get(key)
        if m:
            out.append({"id": eid, "ticker": t, "label": label, "value": m["value"], "unit": unit,
                        "source": m["source"], "asOf": m["asOf"], **({"url": snap["secUrl"]} if m["source"] == "SEC EDGAR" and snap.get("secUrl") else {})})
    for i, n in enumerate(snap.get("news", [])[:5], start=1):
        out.append({"id": f"N{i}", "ticker": t, "label": f"News ({n['source']}): {n['headline']}", "value": sentiment(n["headline"]),
                    "unit": "count", "source": "Finnhub" if n["source"] != "Yahoo Finance" else "yfinance", "asOf": n.get("date") or "", "url": n.get("url")})
    if macro:
        for eid, key, label in [("M1", "inflation", "US inflation, year on year"), ("M2", "tenYear", "10 year Treasury yield"), ("M3", "fedFunds", "Fed funds rate")]:
            out.append({"id": eid, "ticker": t, "label": label, "value": macro[key]["value"], "unit": "%", "source": "FRED", "asOf": macro[key]["asOf"]})
    return out
