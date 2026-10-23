"""FRED: inflation, 10 year Treasury yield, Fed funds rate. Off when FRED_API_KEY is empty."""
import requests

import config
from cache import get_or_fetch


def _obs(series: str, limit: int):
    r = requests.get("https://api.stlouisfed.org/fred/series/observations", timeout=8, params={
        "series_id": series, "api_key": config.FRED_API_KEY, "file_type": "json", "sort_order": "desc", "limit": limit})
    r.raise_for_status()
    return [o for o in r.json()["observations"] if o["value"] != "."]


def macro():
    if not config.FRED_API_KEY:
        return None, False
    def fetch():
        cpi = _obs("CPIAUCSL", 13)
        ten = _obs("DGS10", 5)[0]
        ff = _obs("FEDFUNDS", 2)[0]
        return {
            "inflation": {"value": round((float(cpi[0]["value"]) / float(cpi[12]["value"]) - 1) * 100, 2), "asOf": cpi[0]["date"]},
            "tenYear": {"value": float(ten["value"]), "asOf": ten["date"]},
            "fedFunds": {"value": float(ff["value"]), "asOf": ff["date"]},
        }
    return get_or_fetch("fred:macro", 86400, fetch)
