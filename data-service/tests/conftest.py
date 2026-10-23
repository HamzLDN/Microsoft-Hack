import datetime as dt
import math
import os
import random
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATA_CACHE_DIR", tempfile.mkdtemp())

import pytest


def make_history(drift=0.0004, vol=0.012, days=300, start=100.0, div_every=0, div=0.0, seed=1):
    rnd = random.Random(seed)
    d0, p, rows = dt.date(2025, 1, 1), start, []
    for i in range(days):
        p *= math.exp(drift + vol * rnd.gauss(0, 1))
        rows.append([(d0 + dt.timedelta(days=i)).isoformat(), round(p, 4), div if div_every and i % div_every == 0 else 0.0])
    return rows


def make_snap(t, type_="stock", role=None, themes=(), tags=(), vol=0.012, drift=0.0004, seed=1, **metrics):
    base = {"price": 100, "vol": vol * math.sqrt(252) * 100, "dd": -10, "ret1y": 8, "revGrowth": 8, "fcfMargin": 12,
            "divYield": 1.5, "pe": 22, "mcap": 200}
    base.update(metrics)
    m = {k: {"value": v, "source": "yfinance", "asOf": "2025-10-01"} for k, v in base.items() if v is not None}
    return {"ticker": t, "name": t, "sector": themes[0] if themes else "Fund", "type": type_, "role": role, "themes": list(themes),
            "tags": list(tags), "metrics": m, "news": [], "secUrl": None, "stale": False,
            "history": make_history(drift=drift, vol=vol, seed=seed)}


@pytest.fixture
def snaps():
    s = {}
    for i, t in enumerate(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ"]):
        s[t] = make_snap(t, themes=["Healthcare" if i % 2 else "Technology"], seed=i + 1, revGrowth=5 + i * 3, divYield=0.5 + i * 0.3)
    s["TOB"] = make_snap("TOB", themes=["Consumer staples"], tags=["Tobacco"], seed=40, revGrowth=40, fcfMargin=40, divYield=7)
    s["ZOOM"] = make_snap("ZOOM", themes=["Technology"], vol=0.04, seed=41, revGrowth=60, fcfMargin=-5, divYield=None, pe=None)
    for t, seed in [("BND", 50), ("SHY", 51), ("TIP", 52)]:
        s[t] = make_snap(t, type_="etf", role="bond", vol=0.003, drift=0.0001, seed=seed, revGrowth=None, fcfMargin=None, pe=None)
    s["SGOV"] = make_snap("SGOV", type_="etf", role="cash", vol=0.0003, drift=0.0001, seed=53, revGrowth=None, fcfMargin=None, pe=None)
    return s


@pytest.fixture
def demo_rules():
    return [
        {"id": "C1", "text": "Investing for 9 years", "kind": "hard", "field": "horizon_years", "op": "==", "value": 9, "source": "form", "kindReason": "From the form", "confidence": 1},
        {"id": "C2", "text": "Bad year loss at most $15,000", "kind": "hard", "field": "max_bad_year_loss", "op": "<=", "value": 15000, "source": "text",
         "quote": "can't stomach losing more than about 15%", "kindReason": "You said can't", "confidence": 0.9},
        {"id": "C3", "text": "Exclude tobacco", "kind": "hard", "field": "exclude_tag", "op": "not_in", "value": ["Tobacco"], "source": "text", "kindReason": "You said no", "confidence": 0.95},
        {"id": "C4", "text": "Prefer dividend payers", "kind": "soft", "field": "min_dividend_yield", "op": ">=", "value": 2, "source": "text", "kindReason": "You said I like", "confidence": 0.8},
        {"id": "C5", "text": "Favour healthcare", "kind": "soft", "field": "favour_sector", "op": "in", "value": ["Healthcare"], "source": "text", "kindReason": "You said interested in", "confidence": 0.8},
    ]
