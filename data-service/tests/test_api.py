import pytest

import app as service
import data


@pytest.fixture
def client(snaps, monkeypatch):
    monkeypatch.setattr(service.universe, "ALL", {t: {"ticker": t} for t in snaps} | {"VTI": {}, "BND": {}})
    monkeypatch.setattr(data, "snapshot", lambda t: snaps.get(t))
    monkeypatch.setattr(data, "snapshots", lambda ts, workers=8: {t: snaps[t] for t in ts if t in snaps} | ({"VTI": dict(snaps["AAA"], ticker="VTI", type="etf", role="equity")} if "VTI" in ts else {}))
    monkeypatch.setattr(data, "macro", lambda: None)
    monkeypatch.setattr(service.finnhub, "quote", lambda t: (None, False))
    return service.app.test_client()


def test_health(client):
    assert client.get("/health").json["ok"] is True


def test_evidence_has_stable_ids(client):
    ev = client.get("/evidence/AAA").json["evidence"]
    ids = {e["id"] for e in ev}
    assert {"E1", "E3", "E8"} <= ids
    assert all({"id", "label", "value", "unit", "source", "asOf"} <= set(e) for e in ev)


def test_unknown_ticker_is_404(client):
    assert client.get("/evidence/NOPE").status_code == 404


def test_history_ranges(client):
    for rng, n in [("1W", 6), ("1M", 22)]:
        assert len(client.get(f"/history/AAA?range={rng}").json["points"]) == n


def test_portfolio_endpoint(client, demo_rules):
    p = client.post("/portfolio", json={"rules": demo_rules, "horizon": 9, "risk": 5}).json
    assert sum(h["amount"] for h in p["holdings"]) == 100_000
    assert {"split", "holdings", "considered", "badYearLoss", "typicalRange", "ruleSummary"} <= set(p)


def test_risk_preview(client):
    r = client.post("/risk-preview", json={"horizon": 9, "risk": 5}).json
    assert r["badYearLoss"] > 0 and r["typicalRange"][0] < r["typicalRange"][1]


def test_quote_falls_back_to_history(client):
    q = client.get("/quote/AAA").json
    assert q["source"] == "yfinance" and q["live"] is False
