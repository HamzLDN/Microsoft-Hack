"""Mandate data service. All market data, metrics, scoring and the portfolio engine. Port 5001."""
import logging

from flask import Flask, jsonify, request

import config
import data
import universe
from adapters import finnhub
from engine import evidence as E
from engine import metrics as M
from engine.portfolio import build
from engine.score import default_weights

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)


def _snap_or_404(t):
    t = t.upper()
    if t not in universe.ALL:
        return None, (jsonify({"error": f"{t} is not in the universe"}), 404)
    s = data.snapshot(t)
    return (s, None) if s else (None, (jsonify({"error": f"No data for {t} right now"}), 503))


@app.get("/health")
def health():
    return {"ok": True, "sources": {"finnhub": finnhub.enabled(), "fred": bool(config.FRED_API_KEY),
                                    "sec": bool(config.SEC_USER_AGENT), "yfinance": True}}


@app.get("/universe")
def get_universe():
    return {"tickers": [{k: v for k, v in x.items()} for x in universe.ALL.values()],
            "themes": universe.THEMES, "excludeGroups": universe.EXCLUDE_GROUPS}


@app.get("/quote/<t>")
def quote(t):
    s, err = _snap_or_404(t)
    if err:
        return err
    q, stale = finnhub.quote(s["ticker"])
    if q:
        return {"ticker": s["ticker"], "price": q["c"], "change": q.get("d"), "changePct": q.get("dp"), "source": "Finnhub", "live": not stale}
    h = s["history"]
    return {"ticker": s["ticker"], "price": h[-1][1], "change": round(h[-1][1] - h[-2][1], 2),
            "changePct": round((h[-1][1] / h[-2][1] - 1) * 100, 2), "source": "yfinance", "live": False}


@app.get("/history/<t>")
def history(t):
    s, err = _snap_or_404(t)
    if err:
        return err
    rng = request.args.get("range", "1Y")
    return {"ticker": s["ticker"], "range": rng, "points": M.slice_range(s["history"], rng)}


@app.get("/metrics/<t>")
def metrics(t):
    s, err = _snap_or_404(t)
    return err or {"ticker": s["ticker"], "name": s["name"], "metrics": s["metrics"], "stale": s["stale"]}


@app.get("/news/<t>")
def news(t):
    s, err = _snap_or_404(t)
    return err or {"ticker": s["ticker"], "news": s["news"]}


@app.get("/macro")
def macro():
    return data.macro() or {}


@app.get("/evidence/<t>")
def evidence(t):
    s, err = _snap_or_404(t)
    return err or {"ticker": s["ticker"], "name": s["name"], "evidence": E.build(s, data.macro())}


@app.post("/portfolio")
def portfolio():
    body = request.get_json(force=True, silent=True) or {}
    horizon, risk = float(body.get("horizon", 9)), float(body.get("risk", 5))
    snaps = data.snapshots(list(universe.ALL))
    return jsonify(build(snaps, body.get("rules", []), horizon, risk, body.get("maxHolding", "AI"),
                         body.get("weights"), body.get("overrides"), float(body.get("amount", config.DEFAULT_AMOUNT))))


@app.post("/risk-preview")
def risk_preview():
    body = request.get_json(force=True, silent=True) or {}
    horizon, risk = float(body.get("horizon", 9)), float(body.get("risk", 5))
    amount = float(body.get("amount", config.DEFAULT_AMOUNT))
    snaps = data.snapshots(["VTI", "BND"], workers=2)
    stock_pct = M.stock_share(horizon, risk)
    hold = {"VTI": amount * stock_pct / 100, "BND": amount * (100 - stock_pct) / 100}
    from engine.portfolio import _cov_vol
    vol = _cov_vol(hold, {t: s["history"] for t, s in snaps.items()}, {"VTI": "equity", "BND": "bond"})
    return {"split": {"stocks": stock_pct, "bonds": 100 - stock_pct, "cash": 0}, "badYearLoss": round(M.bad_year_loss(vol, amount)),
            "typicalRange": list(M.typical_range(vol, amount)), "volatility": round(vol, 2)}


@app.get("/weights")
def weights():
    return default_weights(float(request.args.get("horizon", 9)), float(request.args.get("risk", 5)))


if __name__ == "__main__":
    app.run(port=config.PORT, debug=False)
