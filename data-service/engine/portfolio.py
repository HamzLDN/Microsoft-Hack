"""Portfolio engine: rules, scores, stock and bond split, bad year loss limit, dollar amounts, pros and cons."""
import math
from typing import Dict, List, Optional

import numpy as np

from engine import metrics as M
from engine.evidence import METRIC_TO_ID
from engine.rules import check, soft_points
from engine.score import score_all, sentiment

FALLBACK_VOL = {"stock": 25.0, "equity": 16.0, "bond": 6.0, "cash": 0.5}


def _rule(rules, field):
    return next((r for r in rules if r.get("field") == field), None)


def _cov_vol(holdings: Dict[str, float], hist: Dict[str, list], kinds: Dict[str, str]) -> float:
    """Annualised portfolio volatility in percent from the last year of daily returns."""
    total = sum(holdings.values())
    if not total:
        return 0.0
    tickers = [t for t in holdings if hist.get(t)]
    if tickers:
        dates = set.intersection(*(set(r[0] for r in hist[t][-260:]) for t in tickers))
    if not tickers or len(dates) < 30:
        return sum(holdings[t] / total * FALLBACK_VOL[kinds.get(t, "stock")] for t in holdings)
    dates = sorted(dates)
    rets = []
    for t in tickers:
        px = {r[0]: r[1] for r in hist[t]}
        c = [px[d] for d in dates]
        rets.append(M.daily_returns(c))
    cov = np.cov(np.array(rets)) * M.TRADING_DAYS
    w = np.array([holdings[t] / total for t in tickers])
    covered = w.sum()
    vol = math.sqrt(max(float(w @ np.atleast_2d(cov) @ w), 0.0)) * 100
    missing = [t for t in holdings if t not in tickers]  # assets without history add their fallback volatility
    return vol + sum(holdings[t] / total * FALLBACK_VOL[kinds.get(t, "stock")] for t in missing) if covered < 1 else vol


def _bond_mix(horizon: float):
    return {"SHY": 0.5, "BND": 0.3, "TIP": 0.2} if horizon < 5 else {"BND": 0.5, "TIP": 0.25, "SHY": 0.25}


def _equity_weights(scored: List[dict], stock_amt: float, cap_amt: float, floor: float = 1) -> Dict[str, float]:
    """floor lifts companies the client added themselves to at least the lowest score the engine chose."""
    w = {c["ticker"]: max(c["score"]["total"], floor if c.get("forced") else 1, 1) ** 2 for c in scored}
    amounts = {t: 0.0 for t in w}
    remaining, free = stock_amt, set(w)
    while remaining > 1 and free:
        tot = sum(w[t] for t in free)
        newly_capped = set()
        for t in free:
            add = remaining * w[t] / tot
            amounts[t] += add
            if amounts[t] >= cap_amt:
                amounts[t], newly_capped = cap_amt, newly_capped | {t}
        remaining = stock_amt - sum(amounts.values())
        if not newly_capped:
            break
        free -= newly_capped
    return amounts


def _pros_cons(c: dict, snap: dict, checks: List[dict], rules: List[dict]):
    m = {k: v["value"] for k, v in snap["metrics"].items()}
    e = lambda key: [METRIC_TO_ID[key]] if key in m else []
    pros, cons = [], []
    if m.get("revGrowth", 0) >= 10: pros.append((f"Revenue grew **{m['revGrowth']:.1f}%** in a year", e("revGrowth")))
    if m.get("revGrowth", 0) < 0: cons.append((f"Revenue fell **{abs(m['revGrowth']):.1f}%** in a year", e("revGrowth")))
    if m.get("fcfMargin", 0) >= 10: pros.append((f"Turns **{m['fcfMargin']:.1f}%** of revenue into free cash", e("fcfMargin")))
    if "fcfMargin" in m and m["fcfMargin"] < 0: cons.append((f"Burning cash: free cash flow margin **{m['fcfMargin']:.1f}%**", e("fcfMargin")))
    if m.get("divYield", 0) >= 2:
        pros.append((f"Pays **{m['divYield']:.2f}%** a year in {'income' if snap.get('role') in ('bond', 'cash') else 'dividends'}", e("divYield")))
    if "vol" in m and m["vol"] < 20: pros.append((f"Steadier than most: **{m['vol']:.1f}%** volatility", e("vol")))
    if m.get("vol", 0) > 35: cons.append((f"Big price swings: **{m['vol']:.1f}%** volatility", e("vol")))
    if m.get("dd", 0) < -25: cons.append((f"Fell **{abs(m['dd']):.1f}%** from its peak in the last year", e("dd")))
    if 0 < m.get("pe", 0) < 18: pros.append((f"Reasonably priced at **{m['pe']:.1f}** times earnings", e("pe")))
    if m.get("pe", 0) > 40: cons.append((f"Expensive at **{m['pe']:.1f}** times earnings", e("pe")))
    if m.get("ret1y", 0) > 20: pros.append((f"Up **{m['ret1y']:.1f}%** over the last year", e("ret1y")))
    for i, n in enumerate(snap.get("news", [])[:5], start=1):
        s = sentiment(n["headline"])
        if s > 0 and not any(p[1] == [f"N{i}"] for p in pros): pros.append((f"Recent news: {n['headline']}", [f"N{i}"])); break
    for i, n in enumerate(snap.get("news", [])[:5], start=1):
        if sentiment(n["headline"]) < 0: cons.append((f"Recent news: {n['headline']}", [f"N{i}"])); break
    out_p = [{"text": t, "evidenceIds": ids} for t, ids in pros]
    out_c = [{"text": t, "evidenceIds": ids} for t, ids in cons]
    by_id = {r["id"]: r for r in rules}
    for ch in checks:
        r = by_id[ch["ruleId"]]
        if r["field"] in ("horizon_years", "max_bad_year_loss", "max_holding_pct", "note"):
            continue
        (out_p if ch["pass"] else out_c).append({"text": f"{'Meets' if ch['pass'] else 'Fails'} {r['id']}: {ch['detail']}", "evidenceIds": [], "ruleId": r["id"]})
    if not out_p:
        out_p.append({"text": "Spreads your money across many companies" if snap["type"] == "etf" else "Established, widely held company",
                      "evidenceIds": e("mcap")})
    if not out_c:
        role = snap.get("role")
        text = ("Can lose value when interest rates rise" if role == "bond" else "May not keep up with inflation" if role == "cash"
                else "Follows the whole market down in a sell off" if snap["type"] == "etf" else "Single company risk: one bad result can move the price sharply")
        out_c.append({"text": text,
                      "evidenceIds": e("vol")})
    return out_p, out_c


def build(snaps: Dict[str, dict], rules: List[dict], horizon: float = 9, risk: float = 5, max_holding="AI",
          weights: Optional[Dict[str, float]] = None, overrides: Optional[Dict[str, str]] = None, amount: float = 100_000,
          adjustments: Optional[Dict[str, float]] = None) -> dict:
    """adjustments: committee score changes per ticker, from the analysts' discussion."""
    from engine.score import default_weights
    weights, overrides = weights or default_weights(horizon, risk), overrides or {}
    horizon = float((_rule(rules, "horizon_years") or {}).get("value") or horizon)
    loss_rule = _rule(rules, "max_bad_year_loss")
    loss_limit = float(loss_rule["value"]) if loss_rule else None
    hold_rule = _rule(rules, "max_holding_pct")
    if hold_rule and hold_rule.get("value") not in (None, "AI"):
        max_holding = hold_rule["value"]

    hist = {t: s["history"] for t, s in snaps.items()}
    kinds = {t: (s.get("role") or "stock") for t, s in snaps.items()}
    candidates = [s for s in snaps.values() if s["type"] == "stock" or s.get("role") == "equity"]
    scores = score_all(candidates, weights)

    cands = []
    for s in candidates:
        checks = [{"ruleId": r["id"], "pass": ok, "detail": d} for r in rules for ok, d in [check(r, s)]]
        sc = scores[s["ticker"]]
        adj = [{"ruleId": r["id"], "points": soft_points(r, ch["pass"])} for r, ch in zip(rules, checks)
               if r["kind"] == "soft" and r["field"] not in ("horizon_years", "max_bad_year_loss", "max_holding_pct", "note")]
        committee = float((adjustments or {}).get(s["ticker"], 0))
        if committee:
            adj = adj + [{"ruleId": "Committee", "points": round(committee, 1)}]
        sc = {**sc, "ruleAdjustments": adj, "total": round(max(0, min(100, sc["total"] + sum(a["points"] for a in adj))), 1)}
        hard_fail = [ch["ruleId"] for r, ch in zip(rules, checks) if r["kind"] == "hard" and not ch["pass"]]
        cands.append({"snap": s, "ticker": s["ticker"], "checks": checks, "score": sc, "hardFail": hard_fail})

    n = 8 + round((risk - 1) / 9 * 4)
    eligible = sorted([c for c in cands if not c["hardFail"] and overrides.get(c["ticker"]) != "out"], key=lambda c: -c["score"]["total"])
    forced = [c for c in eligible if overrides.get(c["ticker"]) == "in"]
    for c in forced:
        c["forced"] = True
    MAX_FUNDS = 2  # keep the recommendation mostly companies; funds stay available as alternatives
    ranked, funds = [], 0
    for c in eligible:
        if c in forced:
            continue
        if c["snap"]["type"] == "etf":
            if funds >= MAX_FUNDS:
                continue
            funds += 1
        ranked.append(c)
    picks = forced + ranked[: max(n - len(forced), 0)]
    eligible = picks + [c for c in eligible if c not in picks]

    def allocate(stock_pct):
        stock_amt = amount * stock_pct / 100
        cap_pct = float(max_holding) if max_holding not in (None, "AI") else max(5.0, 5 * round((100 / max(len(picks), 1) + 2) / 5))
        cap_amt = amount * cap_pct / 100
        k = len(picks)
        while k * cap_amt < stock_amt and k < len(eligible):  # not enough room under the cap: add more companies
            k += 1
        chosen = picks if k == len(picks) else picks + [c for c in eligible if c not in picks][: k - len(picks)]
        floor = min((c["score"]["total"] for c in chosen if not c.get("forced")), default=1)
        eq = _equity_weights(chosen, stock_amt, cap_amt, floor)
        cash_pct = 5.0 if horizon < 5 else 0.0
        bond_amt = amount - stock_amt - amount * cash_pct / 100
        bonds = {t: bond_amt * w for t, w in _bond_mix(horizon).items() if t in snaps}
        cash = {"SGOV": amount * cash_pct / 100} if cash_pct and "SGOV" in snaps else {}
        hold = {**eq, **bonds, **cash}
        loss = M.bad_year_loss(_cov_vol(hold, hist, kinds), amount)
        return hold, loss, cap_pct, chosen

    stock_pct = M.stock_share(horizon, risk)
    hold, loss, cap_pct, chosen = allocate(stock_pct)
    while loss_limit is not None and loss > loss_limit and stock_pct > 10:
        stock_pct -= 5
        hold, loss, cap_pct, chosen = allocate(stock_pct)

    rounded = {t: round(v / 100) * 100 for t, v in hold.items() if v >= 50}
    if rounded:
        biggest = max(rounded, key=rounded.get)
        rounded[biggest] += round(amount - sum(rounded.values()))
    port_vol = _cov_vol(rounded, hist, kinds)
    loss = M.bad_year_loss(port_vol, amount)

    chosen_ids = {c["ticker"] for c in chosen}
    cutoff = min((c["score"]["total"] for c in chosen), default=0)
    smallest = min((v for t, v in rounded.items() if t in chosen_ids), default=amount * 0.05)

    def what_would(c):
        if c["hardFail"]:
            return f"Only if you remove {' and '.join(c['hardFail'])}"
        if overrides.get(c["ticker"]) == "out":
            return "You dropped it. Swipe it back in to add it"
        if c["snap"]["type"] == "etf" and c["score"]["total"] >= cutoff:
            return "Swipe it in to swap it for a company"
        trial = {t: v * (1 - smallest / amount) for t, v in rounded.items()}
        trial[c["ticker"]] = smallest
        new_loss = M.bad_year_loss(_cov_vol(trial, hist, kinds), amount)
        if loss_limit is not None and new_loss > loss_limit:
            return f"Enters at about ${smallest:,.0f} if you accepted a bad year loss of about ${round(new_loss, -2):,.0f}"
        return f"Enters at about ${smallest:,.0f} if its score rose above {cutoff:.0f}, or if you add it yourself"

    out_cands = []
    for c in cands:
        t, s = c["ticker"], c["snap"]
        pros, cons = _pros_cons(c, s, c["checks"], rules)
        included = t in rounded
        if included:
            reason = pros[0]["text"]
        elif c["hardFail"]:
            failed = next(ch for ch in c["checks"] if ch["ruleId"] == c["hardFail"][0])
            reason = f"Fails {failed['ruleId']}: {failed['detail']}"
        elif overrides.get(t) == "out":
            reason = "Dropped by you"
        elif s["type"] == "etf" and c["score"]["total"] >= cutoff:
            reason = f"Fund limit: at most {MAX_FUNDS} broad funds, so most of your money goes into companies (score {c['score']['total']:.0f})"
        else:
            reason = f"Ranked below the companies chosen (score {c['score']['total']:.0f}, cut off {cutoff:.0f})"
        out_cands.append({"ticker": t, "name": s["name"], "sector": s["sector"], "type": s["type"], "status": "included" if included else "excluded",
                          "amount": rounded.get(t, 0), "score": c["score"], "pros": pros, "cons": cons, "checks": c["checks"],
                          "mainReason": reason, **({} if included else {"whatWouldGetItIn": what_would(c)})})

    fund_holdings = []
    for t in rounded:
        if any(oc["ticker"] == t for oc in out_cands):
            continue
        s = snaps[t]
        role = s.get("role", "bond")
        pros, cons = _pros_cons({}, s, [], rules)
        fund_holdings.append({"ticker": t, "name": s["name"], "sector": "Bonds" if role == "bond" else "Cash", "type": "etf", "status": "included",
                              "amount": rounded[t], "score": {"total": 0, "parts": [], "ruleAdjustments": []}, "pros": pros, "cons": cons,
                              "checks": [], "mainReason": f"{'Bond' if role == 'bond' else 'Cash'} part of your mix for a {horizon:g} year horizon"})

    holdings = sorted([c for c in out_cands if c["status"] == "included"] + fund_holdings, key=lambda c: -c["amount"])
    considered = sorted(out_cands, key=lambda c: (c["status"] != "included", -c["amount"], -c["score"]["total"]))
    stocks = sum(v for t, v in rounded.items() if kinds.get(t) in ("stock", "equity"))
    cash_amt = sum(v for t, v in rounded.items() if kinds.get(t) == "cash")
    split = {"stocks": round(stocks / amount * 100, 1), "cash": round(cash_amt / amount * 100, 1)}
    split["bonds"] = round(100 - split["stocks"] - split["cash"], 1)

    summary = []
    for r in rules:
        f = r["field"]
        if f == "max_bad_year_loss":
            summary.append({"ruleId": r["id"], "status": f"Bad year loss about ${loss:,.0f}, limit ${loss_limit:,.0f}"})
        elif f == "horizon_years":
            summary.append({"ruleId": r["id"], "status": f"{split['stocks']:g}% in stocks for a {horizon:g} year horizon"})
        elif f == "max_holding_pct":
            top = max((v for t, v in rounded.items() if kinds.get(t) in ("stock", "equity")), default=0)
            summary.append({"ruleId": r["id"], "status": f"Largest company holding {top / amount * 100:.1f}%, limit {cap_pct:g}%"})
        elif f == "note":
            summary.append({"ruleId": r["id"], "status": "Noted, but we can't check this automatically"})
        else:
            affected = sum(1 for c in out_cands if any(ch["ruleId"] == r["id"] and not ch["pass"] for ch in c["checks"]))
            summary.append({"ruleId": r["id"], "status": f"{'Excluded' if r['kind'] == 'hard' else 'Scored down'} {affected} companies"
                            if f != "favour_sector" else f"{sum(1 for c in holdings if any(ch['ruleId'] == r['id'] and ch['pass'] for ch in c['checks']))} holdings in favoured areas"})

    return {"split": split, "holdings": holdings, "considered": considered, "badYearLoss": round(loss),
            "typicalRange": list(M.typical_range(port_vol, amount)), "ruleSummary": summary,
            "weights": weights, "volatility": round(port_vol, 2)}
