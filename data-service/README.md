# Mandate data service

Flask on port 5001. Market data, caching, metrics, evidence packs, scoring and the portfolio engine.

```bash
python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python prewarm.py          # fills the cache for all 84 tickers (about 20s); run at kickoff and before the demo
python app.py              # http://localhost:5001
pytest -q                  # 27 tests, no network
```

## Data sources
Keys come from the repo root `.env`. Every key is optional: without one, that source switches off and the next one is used.

| Data | First choice | Fallback |
|---|---|---|
| Live price | Finnhub (`FINNHUB_API_KEY`) | Last yfinance close |
| Price history, return, volatility, drawdown, dividend yield | yfinance | none needed |
| Revenue growth, free cash flow margin | SEC EDGAR annual 10-K (`SEC_USER_AGENT`) | Finnhub, then yfinance |
| P/E, beta, gross margin, market value | Finnhub | yfinance |
| News | Finnhub | yfinance |
| Inflation, 10 year yield, Fed funds | FRED (`FRED_API_KEY`) | omitted |

Every fetch is cached on disk. If an API fails, the last cached value is served and marked stale, so the demo never breaks.

## Endpoints
| Endpoint | Returns |
|---|---|
| `GET /health` | Which sources are switched on |
| `GET /universe` | Tickers with themes and tags, the 15 favour themes, grouped exclusions |
| `GET /quote/<t>` | Price, change, source, live flag |
| `GET /history/<t>?range=1W\|1M\|6M\|1Y\|5Y` | Chart points |
| `GET /metrics/<t>`, `GET /news/<t>`, `GET /macro` | Raw metrics, headlines, FRED macro |
| `GET /evidence/<t>` | Evidence pack for the AI analysts (`Evidence[]` from `shared/contract.ts`) |
| `POST /portfolio` | `Portfolio` from the contract, plus `weights` and `volatility` |
| `POST /risk-preview` | Split, bad year loss in dollars and typical range for the risk slider |
| `GET /weights?horizon=&risk=` | Default score weights |

`POST /portfolio` body: `{ rules: Rule[], horizon, risk, maxHolding: number | "AI", weights?, overrides?: { [ticker]: "in" | "out" }, amount? }`.
Send `weights` to apply a user's learned weights, and `overrides` for swipes.

## Evidence ids (stable for every ticker)
E1 price, E2 1 year return, E3 volatility, E4 largest fall, E5 beta, E6 P/E, E7 dividend yield, E8 revenue growth, E9 free cash flow margin, E10 gross margin, E11 market value, E12 debt to equity, N1 to N5 news headlines (value is sentiment: 1, 0 or minus 1), M1 inflation, M2 10 year yield, M3 Fed funds.

## How the engine decides
1. Hard rules remove companies. Each check is listed per company with its rule id.
2. Score 0 to 100: weighted percentiles for Growth, Profitability, Stability, Income, Valuation and News. Soft rules add or subtract points, shown in `ruleAdjustments`.
3. Stocks share = 20 + 6 × horizon + 4 × (risk minus 5), between 20% and 90%. Bonds split across BND, SHY and TIP by horizon, with 5% cash under 5 years.
4. The top 8 to 12 companies (at most 2 funds) get money in proportion to score squared, capped per holding.
5. Bad year loss = 1.65 × portfolio volatility (from a year of daily returns) × amount. If it is over the client's limit, 5% moves from stocks to bonds until it fits.
6. Every company gets pros and cons citing evidence ids, and every excluded one gets "what would get it in".
