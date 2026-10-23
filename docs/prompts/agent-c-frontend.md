# Agent C: frontend

You are one of three coding agents building **Mandate** in this repo, in parallel, in 2 hours 30 minutes. Read everything below before starting.

## Kickoff rules
* You only edit: `web/app (pages), web/components`. Do not touch other agents' folders.
* The data contract already exists in `shared/contract.ts` (zod) and `shared/contract.py`. Import it; never redefine the shapes. If you must change it, change both files in one small commit and say so in the commit message.
* Wait for Agent B to push the `web/` skeleton (about 5 minutes), then pull and build pages inside it. Never run create-next-app yourself. Until the APIs are ready, work from mock JSON shaped exactly like `shared/contract.ts`.
* Commit small and often, `git pull --rebase` before every push, never commit `.env`. Keys are in `.env` (see `.env.example`). Never print, log or hardcode any key.
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
* LLM: the organiser-provided key is the primary LLM. It lives only in `.env` as `ORGANISER_API_KEY`, with `ORGANISER_API_ENDPOINT` and `ORGANISER_MODEL` (get both from the organisers; the key alone is not enough). All LLM calls go through one wrapper, `web/lib/ai/llm.ts`, which reads `LLM_PROVIDER` (`organiser` by default, then `azure`, then `openai`) so the provider can be switched without touching agent code. Use JSON schema structured outputs and temperature 0. In the pitch, name the Microsoft service the organiser key belongs to. Never hardcode, log or commit the key.
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

## SECTION 3: AGENT C, FRONTEND (Next.js pages and components)

You own `/app/(pages)` and `/components`. Work on mock JSON that matches the contract until 1:50, then switch to the real APIs. Follow the visual style and writing rules in Section 0.

Screens, in order:
1. Login, then "Welcome back. Continue with your preferences from 23 October, or start new?"
2. About you: age, retirement age (auto computes the horizon in years, editable), what the money is for (grow it, income later, income now, a one off goal), when they need it.
3. Preferences:
   * Risk slider 1 to 10 with a live line underneath from `/risk-preview`: "In a bad year, roughly 1 in 20, this mix could fall by about **$11,800**. In a typical year it could move between minus $6,900 and plus $9,400." Also show the stocks, bonds and cash split as a small bar.
   * "Max per holding" label directly beside its options: 5%, 10%, 15%, 20%, Let AI decide.
   * Sectors to favour, 15 chips: Technology, AI and software, Healthcare, Biotech, Financials, Consumer staples, Consumer discretionary, Industrials, Energy, Clean energy, Utilities, Real estate, Materials, Communication, Dividend payers.
   * Exclude, grouped with headings: Ethical (Tobacco, Alcohol, Gambling, Adult, Weapons), Environmental (Fossil fuels, Coal, Mining), Financial risk (Unprofitable, Penny stocks, High debt), Geography (China listed, Emerging markets), Investment type (Leveraged ETFs, Crypto exposed).
   * Free text box.
4. Loading with a staged log that ticks in line by line.
5. "Here's what we understood": rule cards C1..Cn. Each card shows the rule, a Hard rule or Preference pill (tap to switch), and below it "From your words: 'can't stomach losing more than about 15%'. Hard because you said can't." You can remove a card or add your own.
6. Building, with a funnel that counts down.
7. Portfolio: split bar, holdings with amount, one pro and one con each, the score badge, portfolio checks against each rule (including the bad year loss against C2), a trust panel from the eval file, and buttons "See everything we considered" and "Challenge it".
8. Considered: table of every candidate with status, main reason citing the rule, and "what would get it in". Rule chips filter and highlight what each rule affected.
9. Challenge: swipe cards (react-tinder-card) with Own and Drop buttons as well. Each swipe re-calls `/api/portfolio` with overrides, then toasts what changed ("Bad year loss $13,900 to $15,400, now above your C2 limit").
10. Stock drawer, used everywhere:
    * Name, live price (poll `/quote` every 15s, show a "live" dot, or "delayed" if stale).
    * Chart with lightweight-charts and 1W, 1M, 6M, 1Y, 5Y toggles.
    * Metrics grid with info icons; which metrics show is chosen in Settings and saved to preferences.
    * Pros and Cons side by side.
    * Rule checklist.
    * Score breakdown bar with "Where this score comes from": each part, its weight and its evidence. A "Change how we score" panel lets the user drag the weights, then re-run.
    * AI analysis: three analyst cards streaming in. Click a card to expand it into a thread and ask that analyst a follow up. Render **bold**. Show evidence chips that open the source value and date.
    * Decision box with pros and cons. Show "Analysts disagree" when present, and the fallback label when present.
11. Help assistant: floating "Ask" button on every screen, plus "Ask about this" from any info icon, which pre-fills the question. It sends the screen context to `/api/chat` in help mode.
12. Compare (flag): pick up to 2 stocks, side by side metrics, an overlaid normalised chart, pros, cons and rule checks.

Tests (vitest and React Testing Library): rule card toggles hard and soft; the risk preview line renders the dollar figure; the drawer always renders both pros and cons; bold markdown renders; no dash characters (— or –) appear in rendered copy (snapshot test over all mock screens).

Done by 1:15: screens 2 to 8 and the drawer on mocks. 1:50: swipe, help assistant, login, settings. 2:15: real data, polish, transitions.

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


---

## LEARNING FROM USER REFINEMENTS (your part)

Mandate learns from every correction a user makes. No model training: we store corrections and feed them back at run time (in-context learning with memory), and we measure the effect. Never claim the model was trained, and never show an accuracy number that the eval script or the database did not produce.

1. Send `POST /api/feedback` on: switching Hard rule and Preference, editing, removing or adding a rule, every swipe, and every weight change in "Change how we score".
2. On "Here's what we understood", rule cards that came from memory show a small badge: "Learned from 6 earlier corrections".
3. Portfolio screen: a "Learned from you" card listing the notes from `/api/learning` (for example "You value Stability more (+4)"), with a Reset button.
4. Trust panel: correction rate, corrections stored, and the eval before and after accuracy from `eval-results.json`. If a number is missing, hide it rather than show a placeholder.

## Demo beat (adds about 20 seconds)
Before the demo, log in as a second user, type a phrase like "I'd like some tech exposure", switch it from Hard rule to Preference, and repeat once. In the demo, type a similar phrase: the card shows "Learned from 2 earlier corrections" and is already a Preference. Then point at the correction rate and the eval before and after numbers.

## Pitch line
"It doesn't need retraining. Every correction is stored and fed back, so it gets your meaning right first time, and we measure that: here is the correction rate and the before and after accuracy."
