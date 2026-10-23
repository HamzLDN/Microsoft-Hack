"""Finnhub: real time quote, profile, basic financials, company news. Off when FINNHUB_API_KEY is empty."""
import datetime as dt

import requests

import config
from cache import get_or_fetch

BASE = "https://finnhub.io/api/v1"


def _get(path: str, **params):
    params["token"] = config.FINNHUB_API_KEY
    r = requests.get(f"{BASE}/{path}", params=params, timeout=8)
    r.raise_for_status()
    return r.json()


def enabled() -> bool:
    return bool(config.FINNHUB_API_KEY)


def quote(t: str):
    if not enabled():
        return None, False
    def fetch():
        q = _get("quote", symbol=t)
        return q if q.get("c") else None
    return get_or_fetch(f"fh:quote:{t}", 15, fetch)


def metrics(t: str):
    if not enabled():
        return None, False
    return get_or_fetch(f"fh:metric:{t}", 86400, lambda: _get("stock/metric", symbol=t, metric="all").get("metric") or None)


def news(t: str):
    if not enabled():
        return None, False
    def fetch():
        to = dt.date.today()
        items = _get("company-news", symbol=t, **{"from": str(to - dt.timedelta(days=30)), "to": str(to)})
        return [{"headline": i["headline"], "source": i.get("source", "Finnhub"), "url": i.get("url"),
                 "date": dt.datetime.utcfromtimestamp(i["datetime"]).date().isoformat()} for i in items[:8]]
    return get_or_fetch(f"fh:news:{t}", 3600, fetch)
