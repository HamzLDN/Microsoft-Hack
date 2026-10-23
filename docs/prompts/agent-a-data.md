# Agent A: data service and engine

You are one of three coding agents building **Mandate** in this repo, in parallel, in 2 hours 30 minutes. Read everything below before starting.

## Kickoff rules
* You only edit: `data-service/`. Do not touch other agents' folders.
* The data contract already exists in `shared/contract.ts` (zod) and `shared/contract.py`. Import it; never redefine the shapes. If you must change it, change both files in one small commit and say so in the commit message.
* Flask on port 5001. Agent B and C call your endpoints, so get `/evidence/<t>` and `POST /portfolio` returning contract-shaped JSON (mock is fine) within the first 30 minutes, then make them real.
* Commit small and often, `git pull --rebase` before every push, never commit `.env`. Keys are in `.env` (see `.env.example`).
* Write tests as you go (listed in your section). Report at the end what passes and what you could not test.
* The UI target is `docs/mandate-mock.html`. Open it in a browser.

## SECTION 0: SHARED CONTEXT (paste into every agent)

### Product
Mandate is a web app for an individual investor (for example someone aged 58 who plans to retire at 67) with $100,000 to invest. The investor states their goals and limits in a form and in their own words. Mandate turns these into numbered rules (C1, C2, ...), builds a portfolio of stocks and fund ETFs that follows the rules, and shows pros, cons and a pass or fail check against every rule for every company, included or not. Three AI analysts discuss each company. The investor can ask follow up questions, swipe to challenge the portfolio, and ask a help assistant what any metric means.

Tagline: "Your rules. Your portfolio. Every reason shown."

### Judging targets (score 10 on each)
* Client focus: every decision cites the investor's own rules.
* Data and AI: analysts reason over verified evidence across filings, news, prices and macro data. This is hard to do by hand.
* Recommendation: dollar amount per holding, pros and cons everywhere, a score whose sources are visible.
* Originality: rule tracing, "what would get it in", challenge by swiping.
* Execution: polished, fault proof live demo.

### Demo persona (fixed, seeded as the demo account)
* Age 58, retiring at 67, so a 9 year horizon. Wants the money to then pay an income.
* Free text typed in the demo: "I need this money to last. I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like companies that pay dividends, and I'm interested in healthcare."
* Expected rules: C1 horizon 9 years (form), C2 bad year loss at most $15,000 (hard, from "can't stomach losing more than about 15%"), C3 exclude gambling (hard), C4 exclude tobacco (hard), C5 prefer dividend payers (soft, from "I like"), C6 favour healthcare (soft), C7 max per holding chosen by AI (form).
* Demo moments that must happen: one strong growth stock is excluded because adding it pushes the bad year loss above $15,000, and "what would get it in" says "if you accepted a bad year loss of about $17,000". One tobacco company is excluded by C4. One recommended stock still shows real cons.

### Architecture
* Next.js 14 App Router (TypeScript, Tailwind, Framer Motion) is the frontend and the main backend: auth, saved preferences, LLM calls, chat.
* Flask (Python 3.11) data service on port 5001: all market data, caching, metrics, scoring, portfolio engine. Python because yfinance and the maths live there. Next.js API routes call Flask over HTTP. (Optional later: expose the same Flask functions as MCP tools. Not needed for the demo.)
* LLM: Azure OpenAI (say so in the pitch) or OpenAI, model with JSON schema structured outputs, temperature 0.
* Storage: SQLite via Prisma (users, saved preferences, analysis cache). Flask uses a disk cache (diskcache or JSON files).

### Data sources (chosen)
| Source | Use | Notes |
|---|---|---|
| Finnhub | Real time quote, company profile (industry), basic financials (P/E, margins, beta, dividend yield), company news | Primary. Free tier 60 calls per minute, so cache. |
| yfinance | Price history for charts (1W, 1M, 6M, 1Y, 5Y), ETF data, dividends, fallback quote | Cache 1 hour. |
| SEC EDGAR companyfacts | Verified revenue, net income, operating cash flow, capex for the Fundamentals analyst | Needs a User-Agent header with a contact email. |
| FRED | Inflation (CPIAUCSL), 10 year Treasury (DGS10), Fed funds (FEDFUNDS) for real return and bond context | Free key. |
| Not used | Twelve Data (overlaps Finnhub and yfinance), World Bank (country level, not needed for US stocks), Kaggle (static, not real time) | Say this in Q&A: we chose sources by job. |

Universe: about 60 US stocks across 15 sectors plus about 12 ETFs (bond and cash ETFs are required for a pensioner: BND, SHY, TIP, SGOV, VIG, SCHD, VTI, VXUS, XLV, XLU, VNQ, GLD). Include at least one tobacco stock (MO or PM) and one gambling stock (LVS or DKNG) so the exclusion demo works.

### Data contract (TypeScript, mirrored in Python dataclasses)
```ts
type Evidence = { id: string; ticker: string; label: string; value: number; unit: "%"|"$"|"x"|"count"|"years";
  source: "Finnhub"|"yfinance"|"SEC EDGAR"|"FRED"; asOf: string; url?: string }

type Rule = { id: string; text: string; kind: "hard"|"soft";
  field: "horizon_years"|"max_bad_year_loss"|"exclude_tag"|"favour_sector"|"min_dividend_yield"|"profitable"|"max_holding_pct"|"max_volatility"|"note";
  op: "<="|">="|"=="|"in"|"not_in"; value: any;
  source: "form"|"text"; quote?: string;      // exact words the rule came from
  kindReason: string;                          // why hard or soft, shown to the user
  confidence: number }                         // 0 to 1

type ScoreBreakdown = { total: number; parts: { name: "Growth"|"Profitability"|"Stability"|"Income"|"Valuation"|"News"; weight: number; value: number; evidenceIds: string[] }[];
  ruleAdjustments: { ruleId: string; points: number }[] }

type Candidate = { ticker: string; name: string; sector: string; type: "stock"|"etf";
  status: "included"|"excluded"; amount: number; score: ScoreBreakdown;
  pros: { text: string; evidenceIds: string[]; ruleId?: string }[];
  cons: { text: string; evidenceIds: string[]; ruleId?: string }[];
  checks: { ruleId: string; pass: boolean; detail: string }[];
  mainReason: string; whatWouldGetItIn?: string }

type Portfolio = { split: { stocks: number; bonds: number; cash: number };
  holdings: Candidate[]; considered: Candidate[];
  badYearLoss: number; typicalRange: [number, number]; ruleSummary: { ruleId: string; status: string }[] }

type AnalystOutput = { agent: "fundamentals"|"markets"|"fit"; stance: "include"|"exclude"|"neutral"; confidence: number;
  points: { text: string; polarity: "pro"|"con"; evidenceIds: string[] }[];  // text uses **bold** for key figures
  summary: string; fallback: boolean }
```

### Flask endpoints
`GET /health`, `GET /universe`, `GET /quote/<t>`, `GET /history/<t>?range=1W|1M|6M|1Y|5Y`, `GET /metrics/<t>`, `GET /news/<t>`, `GET /fundamentals/<t>`, `GET /macro`, `GET /evidence/<t>`, `POST /portfolio`, `POST /risk-preview`.

### Next.js API routes
`/api/auth/*`, `GET|PUT /api/preferences`, `POST /api/parse`, `POST /api/portfolio` (proxies Flask), `GET /api/analysis/[ticker]` (three analysts, streamed), `POST /api/chat` (follow up with one analyst, or the help assistant), `GET /api/compare?a=&b=` (behind a feature flag).

### Writing rules for all UI text and AI output
* Plain English for a non expert. Every metric has an info icon with a one sentence meaning and "Ask about this".
* No dashes as punctuation anywhere in the UI or AI text. Use commas, "to" for ranges, and "minus" or a minus sign only inside numbers.
* Bold the key figure and the verdict in every analyst point.
* Always show pros and cons together, even for included stocks.
* Footer on every page: "Educational hackathon project. Not financial advice."

### Visual style
Paper style, white and baby blue. Tokens: paper `#FBFCFD`, card `#FFFFFF`, ink `#1B2733`, muted `#5E6E7E`, line `#DCE6EF`, baby blue `#D9ECFA`, blue accent `#2F7FC1` (text and buttons, readable on white), good `#2E7D5B`, bad `#B4473A`. Headings in Newsreader (serif), body in Source Sans 3, numbers in IBM Plex Mono. Hairline borders, generous whitespace, soft shadows only on the drawer. Transitions with Framer Motion: screens fade and rise 12px, drawer slides from the right, chips stagger in.

---

## SECTION 1: AGENT A, DATA SERVICE AND ENGINE (Flask, Python)

You own `/data-service`. Build a Flask app on port 5001 that implements every Flask endpoint in the contract. No network calls in tests.

1. Adapters with caching (diskcache): `finnhub.py` (quote TTL 15s, profile 1 day, basic financials 1 day, news 1 hour), `yf.py` (history TTL 1 hour), `edgar.py` (companyfacts, map ticker to CIK with the SEC ticker file, TTL 1 day, User-Agent header from env), `fred.py` (TTL 1 day). Every adapter returns a fallback from the last cached value if the call fails, and marks it `stale: true`.
2. `prewarm.py`: fetch everything for the universe and the demo tickers, respecting 60 calls per minute. Run it at 0:15 and again at 2:10.
3. Metrics: 1Y volatility (annualised stdev of daily returns), max drawdown, beta (from Finnhub), dividend yield, revenue growth and free cash flow margin from SEC (FCF = operating cash flow minus capex), P/E. Return each as an Evidence item with id, source and asOf.
4. `GET /evidence/<t>`: the evidence pack for one ticker. Ids are stable (E1, E2, ...) and per ticker. Include the top 5 news headlines from the last 30 days as items with unit "count" and the headline in `label`, plus FRED macro items.
5. Exclusion tags: a static map from Finnhub industry and a small manual list to tags in these groups: Ethical (tobacco, alcohol, gambling, adult, weapons), Environmental (fossil fuels, coal, mining), Financial risk (unprofitable, penny stock, high debt), Geography (China listed, emerging markets), Investment type (leveraged ETF, crypto exposed).
6. Score (0 to 100): each part is the percentile of the ticker within the universe: Growth (revenue growth), Profitability (FCF margin), Stability (low volatility and drawdown), Income (dividend yield), Valuation (inverse P/E), News (share of positive headlines, simple keyword sentiment). Default weights for an individual with horizon H and risk R (1 to 10): Stability 30, Income 25, Profitability 20, Valuation 10, Growth 10, News 5 for H under 10 and R under 6, shifting toward Growth as H and R rise. Accept user weights from the request. Soft rules add or subtract up to 8 points each and are listed in `ruleAdjustments`.
7. Portfolio engine (`POST /portfolio`):
   * Split: stocks % = clamp(20 + 6×H + 4×(R minus 5), 20, 90). Bonds take the rest, with 5% cash if H < 5.
   * Hard rules remove candidates first.
   * Stocks: take the top N by score (N = 8 to 12 by risk), weight proportional to score squared, cap at max holding. If max holding is "AI", use 100 / N + 2, rounded to 5. Bonds: split between BND, SHY and TIP by horizon.
   * Bad year loss = 1.65 × portfolio volatility (from the 1Y covariance of daily returns) × $100,000. If it exceeds the C2 limit, move 5% from stocks to bonds and repeat until it fits.
   * Typical range = ±1 × portfolio volatility × $100,000.
   * For each excluded candidate compute `whatWouldGetItIn`. For hard rule fails: "Only if you remove C3". For the loss limit: re-run with that stock forced in and report the new bad year loss. For ranked out: "Enters if its score rises above X or if you add it yourself."
   * Pros and cons are generated by code from evidence, always at least one of each, each citing evidence ids and rule ids.
8. `POST /risk-preview {risk, horizon}`: returns the split, bad year loss in dollars and the typical range, used live under the risk slider ("In a bad year, roughly 1 in 20, this mix could fall by about $11,800").
9. Tests (pytest, fixtures recorded to JSON, no network): volatility and drawdown on a known series; score parts sum to the total; hard rules exclude tagged tickers; holdings sum to exactly $100,000; no holding above the cap; bad year loss never exceeds the C2 limit; the split respects horizon; every pro and con cites an existing evidence id; adapters fall back to cache when the HTTP call raises.

Done by 1:15: all endpoints return real data for the demo tickers. Done by 1:50: whatWouldGetItIn, risk preview, tests green.

---

## SHARED TIMELINE (2 hours 30 minutes)

| Time | Agent A (data) | Agent B (AI and API) | Agent C (frontend) |
|---|---|---|---|
| 0:00 to 0:15 | Scaffold Flask, universe list, keys | Scaffold Next, Prisma, zod contract, seed user | Shell, theme tokens, mock JSON |
| 0:15 to 1:15 | Adapters, prewarm, metrics, evidence, score, engine | Parse (two passes), three analysts, guardrails, streaming | Preferences, understood, portfolio, considered, drawer |
| 1:15 to 1:50 | What would get it in, risk preview, pytest | Auth, preferences, chat, vitest, first eval run | Swipe, help assistant, login, settings, score breakdown |
| 1:50 to 2:15 | Integration fixes | Prompt fixes from evals, second eval run | Switch to real APIs, transitions |
| 2:15 to 2:30 | Pre-warm demo data, freeze | Pre-warm analysis cache, freeze | Demo walkthrough, backup mode (load cached demo run with one key) |

Cut order if behind: Compare, live quote polling, weight editing, login (fall back to the seeded demo user). Never cut: rules with quotes, pros and cons everywhere, the drawer with three analysts and guardrails, considered list, bad year loss line.
