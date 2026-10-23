"""SEC EDGAR companyfacts: annual revenue, operating cash flow, capex. Off when SEC_USER_AGENT is empty."""
import requests

import config
from cache import get_or_fetch

REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"]
OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities"]
CAPEX_TAGS = ["PaymentsToAcquirePropertyPlantAndEquipment"]


def enabled() -> bool:
    return bool(config.SEC_USER_AGENT)


def _get(url: str):
    r = requests.get(url, headers={"User-Agent": config.SEC_USER_AGENT}, timeout=10)
    r.raise_for_status()
    return r.json()


def _cik(t: str):
    table, _ = get_or_fetch("sec:tickers", 7 * 86400, lambda: {v["ticker"]: v["cik_str"] for v in
                                                                _get("https://www.sec.gov/files/company_tickers.json").values()})
    return (table or {}).get(t.replace("-", ".")) or (table or {}).get(t)


def annual(facts: dict, tags):
    """Latest full-year 10-K values for the first tag that has them: [(end, value)], newest first."""
    usgaap = facts.get("facts", {}).get("us-gaap", {})
    for tag in tags:
        units = usgaap.get(tag, {}).get("units", {}).get("USD", [])
        rows = {}
        for u in units:
            if u.get("form") != "10-K" or u.get("fp") != "FY" or not u.get("start"):
                continue
            days = (_date(u["end"]) - _date(u["start"])).days
            if 350 <= days <= 380:
                rows[u["end"]] = u["val"]  # later filings overwrite restated values
        if len(rows) >= 2:
            return sorted(rows.items(), reverse=True)[:3]
    return []


def _date(s: str):
    import datetime as dt
    return dt.date.fromisoformat(s)


def fundamentals(t: str):
    if not enabled():
        return None, False
    def fetch():
        cik = _cik(t)
        if not cik:
            return None
        facts = _get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json")
        out = {"revenue": annual(facts, REVENUE_TAGS), "ocf": annual(facts, OCF_TAGS), "capex": annual(facts, CAPEX_TAGS),
               "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={int(cik)}&type=10-K"}
        return out if out["revenue"] else None
    return get_or_fetch(f"sec:facts:{t}", 86400, fetch)
