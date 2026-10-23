"""The stocks and ETFs Mandate can choose from. Themes feed "sectors to favour"; tags feed "exclude".

Theme and tag names match the UI chips exactly. Data-driven tags (unprofitable, penny stock, high debt)
and the "Dividend payers" theme are added at runtime from live metrics.
"""

def _s(t, name, sector, themes=(), tags=()):
    return {"ticker": t, "name": name, "sector": sector, "type": "stock", "themes": [sector, *themes], "tags": list(tags)}


def _e(t, name, role, themes=(), tags=()):
    return {"ticker": t, "name": name, "sector": "Fund", "type": "etf", "role": role, "themes": list(themes), "tags": list(tags)}


STOCKS = [
    _s("AAPL", "Apple", "Technology"), _s("MSFT", "Microsoft", "Technology", ["AI and software"]),
    _s("NVDA", "Nvidia", "Technology", ["AI and software"]), _s("AVGO", "Broadcom", "Technology", ["AI and software"]),
    _s("AMD", "Advanced Micro Devices", "Technology", ["AI and software"]), _s("ORCL", "Oracle", "Technology", ["AI and software"]),
    _s("CRM", "Salesforce", "AI and software"), _s("ADBE", "Adobe", "AI and software"), _s("NOW", "ServiceNow", "AI and software"),
    _s("GOOGL", "Alphabet", "Communication", ["AI and software"]), _s("META", "Meta Platforms", "Communication", ["AI and software"]),
    _s("NFLX", "Netflix", "Communication"), _s("DIS", "Walt Disney", "Communication"), _s("VZ", "Verizon", "Communication"),
    _s("JNJ", "Johnson & Johnson", "Healthcare"), _s("UNH", "UnitedHealth", "Healthcare"), _s("ABBV", "AbbVie", "Healthcare"),
    _s("LLY", "Eli Lilly", "Healthcare"), _s("MRK", "Merck", "Healthcare"), _s("PFE", "Pfizer", "Healthcare"),
    _s("ABT", "Abbott Laboratories", "Healthcare"), _s("TMO", "Thermo Fisher", "Healthcare"),
    _s("VRTX", "Vertex Pharmaceuticals", "Biotech", ["Healthcare"]), _s("REGN", "Regeneron", "Biotech", ["Healthcare"]),
    _s("AMGN", "Amgen", "Biotech", ["Healthcare"]), _s("GILD", "Gilead Sciences", "Biotech", ["Healthcare"]),
    _s("JPM", "JPMorgan Chase", "Financials"), _s("V", "Visa", "Financials"), _s("MA", "Mastercard", "Financials"),
    _s("BRK-B", "Berkshire Hathaway", "Financials"), _s("GS", "Goldman Sachs", "Financials"),
    _s("COIN", "Coinbase", "Financials", tags=["Crypto exposed"]),
    _s("PG", "Procter & Gamble", "Consumer staples"), _s("KO", "Coca-Cola", "Consumer staples"),
    _s("PEP", "PepsiCo", "Consumer staples"), _s("COST", "Costco", "Consumer staples"), _s("WMT", "Walmart", "Consumer staples"),
    _s("CL", "Colgate-Palmolive", "Consumer staples"),
    _s("MO", "Altria", "Consumer staples", tags=["Tobacco"]), _s("PM", "Philip Morris", "Consumer staples", tags=["Tobacco"]),
    _s("STZ", "Constellation Brands", "Consumer staples", tags=["Alcohol"]), _s("BUD", "Anheuser-Busch InBev", "Consumer staples", tags=["Alcohol"]),
    _s("AMZN", "Amazon", "Consumer discretionary", ["AI and software"]), _s("HD", "Home Depot", "Consumer discretionary"),
    _s("MCD", "McDonald's", "Consumer discretionary"), _s("NKE", "Nike", "Consumer discretionary"),
    _s("TSLA", "Tesla", "Consumer discretionary", ["Clean energy"]),
    _s("LVS", "Las Vegas Sands", "Consumer discretionary", tags=["Gambling"]), _s("DKNG", "DraftKings", "Consumer discretionary", tags=["Gambling"]),
    _s("BABA", "Alibaba", "Consumer discretionary", tags=["China listed", "Emerging markets"]),
    _s("CAT", "Caterpillar", "Industrials"), _s("HON", "Honeywell", "Industrials"), _s("UNP", "Union Pacific", "Industrials"),
    _s("GE", "GE Aerospace", "Industrials"), _s("LMT", "Lockheed Martin", "Industrials", tags=["Weapons"]),
    _s("RTX", "RTX", "Industrials", tags=["Weapons"]), _s("GD", "General Dynamics", "Industrials", tags=["Weapons"]),
    _s("XOM", "Exxon Mobil", "Energy", tags=["Fossil fuels"]), _s("CVX", "Chevron", "Energy", tags=["Fossil fuels"]),
    _s("COP", "ConocoPhillips", "Energy", tags=["Fossil fuels"]),
    _s("NEE", "NextEra Energy", "Utilities", ["Clean energy"]), _s("DUK", "Duke Energy", "Utilities"), _s("SO", "Southern Company", "Utilities"),
    _s("ENPH", "Enphase Energy", "Clean energy", ["Technology"]), _s("FSLR", "First Solar", "Clean energy", ["Technology"]),
    _s("PLD", "Prologis", "Real estate"), _s("O", "Realty Income", "Real estate"), _s("AMT", "American Tower", "Real estate"),
    _s("LIN", "Linde", "Materials"), _s("SHW", "Sherwin-Williams", "Materials"),
    _s("NEM", "Newmont", "Materials", tags=["Mining"]), _s("FCX", "Freeport-McMoRan", "Materials", tags=["Mining"]),
]

ETFS = [
    _e("BND", "Vanguard Total Bond Market", "bond"), _e("SHY", "iShares 1-3 Year Treasury", "bond"),
    _e("TIP", "iShares TIPS Bond", "bond"), _e("SGOV", "iShares 0-3 Month Treasury", "cash"),
    _e("VTI", "Vanguard Total Stock Market", "equity"), _e("VXUS", "Vanguard Total International", "equity", tags=["Emerging markets"]),
    _e("VIG", "Vanguard Dividend Appreciation", "equity", ["Dividend payers"]), _e("SCHD", "Schwab US Dividend Equity", "equity", ["Dividend payers"]),
    _e("XLV", "Health Care Select Sector", "equity", ["Healthcare"]), _e("XLU", "Utilities Select Sector", "equity", ["Utilities"]),
    _e("VNQ", "Vanguard Real Estate", "equity", ["Real estate"]), _e("ICLN", "iShares Global Clean Energy", "equity", ["Clean energy"]),
]

ALL = {x["ticker"]: x for x in STOCKS + ETFS}
DEMO_TICKERS = ["JNJ", "ABBV", "UNH", "PG", "KO", "MSFT", "NVDA", "MO", "LVS", "VIG", "BND", "SHY", "TIP"]

THEMES = ["Technology", "AI and software", "Healthcare", "Biotech", "Financials", "Consumer staples", "Consumer discretionary",
          "Industrials", "Energy", "Clean energy", "Utilities", "Real estate", "Materials", "Communication", "Dividend payers"]
EXCLUDE_GROUPS = {
    "Ethical": ["Tobacco", "Alcohol", "Gambling", "Adult", "Weapons"],
    "Environmental": ["Fossil fuels", "Coal", "Mining"],
    "Financial risk": ["Unprofitable", "Penny stocks", "High debt"],
    "Geography": ["China listed", "Emerging markets"],
    "Investment type": ["Leveraged ETFs", "Crypto exposed"],
}
