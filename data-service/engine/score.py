"""0 to 100 score built from visible parts. Each part is the ticker's percentile among the candidates."""
from typing import Dict, List, Optional

PARTS = ["Growth", "Profitability", "Stability", "Income", "Valuation", "News"]
POSITIVE = {"beat", "beats", "record", "growth", "raises", "raised", "upgrade", "upgraded", "approval", "approved", "wins", "surge",
            "strong", "expands", "partnership", "profit", "rises", "gains", "outperform", "buyback", "dividend increase"}
NEGATIVE = {"miss", "misses", "cut", "cuts", "downgrade", "downgraded", "lawsuit", "probe", "investigation", "recall", "layoffs",
            "falls", "plunge", "slump", "warning", "fine", "fined", "loss", "decline", "weak", "delay", "delayed", "sued"}


def sentiment(headline: str) -> int:
    words = set(headline.lower().replace(",", " ").replace(".", " ").split())
    return (len(words & POSITIVE) > 0) - (len(words & NEGATIVE) > 0)


def default_weights(horizon: float, risk: float) -> Dict[str, float]:
    """Careful defaults for an individual near retirement, shifting toward growth with longer horizons and more risk."""
    t = max(-0.5, min(1.0, (horizon - 10) / 20 + (risk - 5) / 10))
    w = {"Growth": 10 + 20 * t, "Profitability": 20, "Stability": 30 - 15 * t, "Income": 25 - 10 * t, "Valuation": 10, "News": 5 + 5 * t}
    total = sum(w.values())
    return {k: round(v / total * 100, 1) for k, v in w.items()}


def _raw(snap: dict) -> Dict[str, Optional[float]]:
    m = {k: v["value"] for k, v in snap["metrics"].items()}
    news = [sentiment(n["headline"]) for n in snap.get("news", [])[:5]]
    pe = m.get("pe")
    stab = None if m.get("vol") is None else -m["vol"] + 0.5 * (m.get("dd") or 0)
    return {"Growth": m.get("revGrowth"), "Profitability": m.get("fcfMargin"), "Stability": stab, "Income": m.get("divYield"),
            "Valuation": -pe if pe and pe > 0 else None, "News": sum(news) / len(news) if news else None}


PART_EVIDENCE = {"Growth": ["E8"], "Profitability": ["E9"], "Stability": ["E3", "E4"], "Income": ["E7"], "Valuation": ["E6"],
                 "News": ["N1", "N2", "N3", "N4", "N5"]}


def score_all(snaps: List[dict], weights: Dict[str, float]) -> Dict[str, dict]:
    raws = {s["ticker"]: _raw(s) for s in snaps}
    pct: Dict[str, Dict[str, Optional[float]]] = {t: {} for t in raws}
    for part in PARTS:
        vals = sorted(v[part] for v in raws.values() if v[part] is not None)
        for t, r in raws.items():
            x = r[part]
            if x is None or len(vals) < 2:
                pct[t][part] = None
            else:
                below = sum(1 for v in vals if v < x)
                equal = sum(1 for v in vals if v == x)
                pct[t][part] = round((below + 0.5 * (equal - 1)) / (len(vals) - 1) * 100, 1)
    out = {}
    for s in snaps:
        t, ev = s["ticker"], set(_ids(s))
        parts = [{"name": p, "weight": weights.get(p, 0), "value": pct[t][p] if pct[t][p] is not None else 50.0,
                  "evidenceIds": [e for e in PART_EVIDENCE[p] if e in ev] if pct[t][p] is not None else []} for p in PARTS]
        total = sum(p["weight"] * p["value"] for p in parts) / max(sum(p["weight"] for p in parts), 1)
        out[t] = {"total": round(total, 1), "parts": parts, "ruleAdjustments": []}
    return out


def _ids(snap: dict) -> List[str]:
    from engine.evidence import METRIC_TO_ID
    return [METRIC_TO_ID[k] for k in snap["metrics"] if k in METRIC_TO_ID] + [f"N{i}" for i in range(1, min(len(snap.get("news", [])), 5) + 1)]
