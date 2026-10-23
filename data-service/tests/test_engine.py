from engine import evidence as E
from engine.portfolio import build
from engine.rules import check
from engine.score import default_weights, score_all, sentiment


def test_score_total_is_weighted_mean_of_parts(snaps):
    w = default_weights(9, 5)
    stocks = [s for s in snaps.values() if s["type"] == "stock"]
    for sc in score_all(stocks, w).values():
        expected = sum(p["weight"] * p["value"] for p in sc["parts"]) / sum(p["weight"] for p in sc["parts"])
        assert abs(sc["total"] - round(expected, 1)) < 0.11
        assert 0 <= sc["total"] <= 100


def test_weights_sum_to_100_and_shift_with_horizon():
    for h, r in [(1, 1), (9, 5), (30, 10)]:
        assert abs(sum(default_weights(h, r).values()) - 100) < 0.5
    assert default_weights(30, 10)["Growth"] > default_weights(5, 2)["Growth"]


def test_rule_checks(snaps):
    tob, zoom = snaps["TOB"], snaps["ZOOM"]
    ex = {"field": "exclude_tag", "value": ["tobacco"]}
    assert check(ex, tob)[0] is False and check(ex, zoom)[0] is True
    assert check({"field": "profitable"}, zoom)[0] is False
    assert check({"field": "favour_sector", "value": "technology"}, zoom)[0] is True
    assert check({"field": "max_bad_year_loss", "value": 1}, zoom)[0] is True  # portfolio level


def test_sentiment():
    assert sentiment("Company beats estimates, raises guidance") == 1
    assert sentiment("Regulator opens probe after recall") == -1
    assert sentiment("Company holds annual meeting") == 0


def test_portfolio_sums_to_amount_and_respects_cap(snaps, demo_rules):
    p = build(snaps, demo_rules, horizon=9, risk=5, max_holding=15)
    assert sum(h["amount"] for h in p["holdings"]) == 100_000
    for h in p["holdings"]:
        if h["sector"] not in ("Bonds", "Cash"):
            assert h["amount"] <= 15_000 + 100  # rounding to $100
    assert abs(p["split"]["stocks"] + p["split"]["bonds"] + p["split"]["cash"] - 100) < 0.2


def test_hard_rule_excludes_and_explains(snaps, demo_rules):
    p = build(snaps, demo_rules)
    tob = next(c for c in p["considered"] if c["ticker"] == "TOB")
    assert tob["status"] == "excluded"
    assert tob["mainReason"].startswith("Fails C3")
    assert tob["whatWouldGetItIn"] == "Only if you remove C3"


def test_loss_limit_is_respected(snaps, demo_rules):
    p = build(snaps, demo_rules, horizon=9, risk=5)
    assert p["badYearLoss"] <= 15_000 * 1.03  # small tolerance from rounding amounts after the limit is applied
    tight = [dict(r, value=4000) if r["field"] == "max_bad_year_loss" else r for r in demo_rules]
    q = build(snaps, tight, horizon=9, risk=5)
    assert q["split"]["stocks"] < p["split"]["stocks"]


def test_every_candidate_has_pros_cons_and_valid_evidence(snaps, demo_rules):
    p = build(snaps, demo_rules)
    for c in p["considered"] + p["holdings"]:
        assert c["pros"] and c["cons"]
        if c["ticker"] in snaps:
            ids = {e["id"] for e in E.build(snaps[c["ticker"]])}
            for point in c["pros"] + c["cons"]:
                assert set(point["evidenceIds"]) <= ids, (c["ticker"], point)


def test_overrides_add_and_drop(snaps, demo_rules):
    base = build(snaps, demo_rules)
    included = [h["ticker"] for h in base["holdings"] if h["ticker"] in snaps and snaps[h["ticker"]]["type"] == "stock"]
    excluded = [c["ticker"] for c in base["considered"] if c["status"] == "excluded" and not c["mainReason"].startswith("Fails")]
    q = build(snaps, demo_rules, overrides={included[0]: "out", **({excluded[0]: "in"} if excluded else {})})
    statuses = {c["ticker"]: c["status"] for c in q["considered"]}
    assert statuses[included[0]] == "excluded"
    if excluded:
        assert statuses[excluded[0]] == "included"


def test_excluded_by_rank_says_what_would_get_it_in(snaps, demo_rules):
    p = build(snaps, demo_rules, risk=1)
    ranked_out = [c for c in p["considered"] if c["status"] == "excluded" and c["mainReason"].startswith("Ranked")]
    for c in ranked_out:
        assert c["whatWouldGetItIn"].startswith("Enters at about $")


def test_at_most_two_equity_funds_unless_forced(snaps, demo_rules):
    from tests.conftest import make_snap
    s = dict(snaps)
    for i in range(5):
        s[f"F{i}"] = make_snap(f"F{i}", type_="etf", role="equity", themes=["Dividend payers"], seed=60 + i, vol=0.006,
                               revGrowth=None, fcfMargin=None, pe=None, divYield=4)
    p = build(s, demo_rules)
    funds = [h for h in p["holdings"] if h["ticker"] in {f"F{i}" for i in range(5)}]
    assert len(funds) <= 2


def test_swiped_in_company_gets_a_real_share(snaps, demo_rules):
    base = build(snaps, demo_rules)
    out = [c for c in base["considered"] if c["status"] == "excluded" and c["mainReason"].startswith("Ranked")]
    if not out:
        return
    t = out[-1]["ticker"]
    q = build(snaps, demo_rules, overrides={t: "in"})
    stocks = [h["amount"] for h in q["holdings"] if h["ticker"] in snaps and snaps[h["ticker"]]["type"] == "stock" and h["ticker"] != t]
    added = next(h["amount"] for h in q["holdings"] if h["ticker"] == t)
    assert added >= min(stocks) - 100
