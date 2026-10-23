"""yfinance: price history (with dividends), company info and news. No key needed."""
import yfinance as yf

from cache import get_or_fetch

INFO_FIELDS = ["longName", "shortName", "quoteType", "sector", "industry", "beta", "trailingPE", "revenueGrowth",
               "grossMargins", "freeCashflow", "totalRevenue", "marketCap", "profitMargins"]


def history(t: str):
    """5 years of daily [date, close, dividend]."""
    def fetch():
        df = yf.Ticker(t).history(period="5y", interval="1d", auto_adjust=True)
        if df.empty:
            return None
        divs = df["Dividends"] if "Dividends" in df else 0
        return [[d.date().isoformat(), round(float(c), 4), round(float(v), 4)]
                for d, c, v in zip(df.index, df["Close"], divs if hasattr(divs, "__iter__") else [0] * len(df))]
    return get_or_fetch(f"yf:hist:{t}", 3600, fetch)


def info(t: str):
    def fetch():
        raw = yf.Ticker(t).info or {}
        out = {k: raw.get(k) for k in INFO_FIELDS}
        return out if any(v is not None for v in out.values()) else None
    return get_or_fetch(f"yf:info:{t}", 86400, fetch)


def news(t: str):
    def fetch():
        out = []
        for item in (yf.Ticker(t).news or [])[:8]:
            c = item.get("content", item)  # newer yfinance nests fields under "content"
            title = c.get("title")
            if not title:
                continue
            provider = c.get("provider") or {}
            url = (c.get("canonicalUrl") or {}).get("url") or c.get("link")
            out.append({"headline": title, "source": provider.get("displayName") or c.get("publisher") or "Yahoo Finance",
                        "url": url, "date": str(c.get("pubDate") or "")[:10]})
        return out or None
    return get_or_fetch(f"yf:news:{t}", 3600, fetch)
