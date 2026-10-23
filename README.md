# Mandate

Your rules. Your portfolio. Every reason shown.

Mandate is a web app for an individual investor with $100,000. They state their goals and limits in a form and in their own words. Mandate turns these into numbered rules (C1, C2, ...), builds a portfolio of stocks and ETFs that follows them, and shows pros, cons and a pass or fail check against every rule for every company. Three AI analysts discuss each company, and the investor can question them.

Microsoft x LSEG London Hackathon 2026. Educational project. Not financial advice.

## Repo layout

| Folder | Owner | What |
|---|---|---|
| `data-service/` | Agent A | Flask (Python 3.11) on port 5001: market data, caching, metrics, scoring, portfolio engine |
| `web/` (`app/api`, `lib`) | Agent B | Next.js API: login, saved preferences, preference parsing, three AI analysts, chat, learning |
| `web/` (pages, `components`) | Agent C | Next.js frontend |
| `shared/` | Everyone, change only together | Data contract (`contract.ts`, `contract.py`) and mock JSON |
| `docs/` | | Master plan, agent prompts, UI mock |

## Run it

```bash
./start.sh            # data service on :5001, web app on http://localhost:3000
./start.sh --reset    # same, but wipes saved users, preferences and learning first (do this before the demo)
```

Demo logins (seeded test accounts, password `demo1234` for both):
* **John Doe**: `john.doe@mandate.app` (use this one in the demo)
* `demo@mandate.app`

Anyone can also create an account. Backstage, with the AI discussions and chats, is at `http://localhost:3000/backstage`.

Needs Python 3.11 and Node 20. On the hackathon Mac, Node lives in `~/.local/node` and `start.sh` adds it to the PATH.

## Keys (all optional, in the repo root `.env`, see `.env.example`)

| Key | Switches on | Without it |
|---|---|---|
| `ORGANISER_API_KEY` (your team key from the hackathon portal) | AI analysts, committee discussion, AI preference parsing, AI chat, all on **gpt-6.1-sol** via the hackathon Azure OpenAI gateway | Keyword parser and discussions built directly from the data; still fully working |
| `FINNHUB_API_KEY` | Live quotes, Finnhub ratios and news | yfinance |
| `SEC_USER_AGENT` | Annual revenue and free cash flow from 10-K filings | yfinance |
| `FRED_API_KEY` | Inflation and interest rates for the markets analyst | Left out |

Check the AI key with `http://localhost:3000/api/llm-health`, and data sources with `http://localhost:5001/health`. Every AI discussion and chat is visible at `http://localhost:3000/backstage`.

The committee review takes about two minutes on gpt-6.1-sol the first time; the same preferences then load instantly for three hours, so rehearse once before presenting.

## MCP (server-side, for the chatbot)

The **Help** chat runs a **server-side MCP client** that spawns `mcp-server/` and calls tools (`get_quote`, `search_universe`, etc.) so answers use the data service, not guessed prices. Built automatically when you `npm run dev` or `npm run build` in `web/`.

Set `FINNHUB_API_KEY` in `.env` when you have it for live quotes.

## Tests

```bash
cd data-service && .venv/bin/python -m pytest -q   # 28 tests: maths, scoring, rules, engine, API, cache
cd web && npm test                                  # 22 tests: guardrails, parser, learning, decision, no dashes in copy
cd web && npm run eval                              # rule accuracy before and after learning, written to eval-results.json
```

## How the AI stays accurate

1. The data service builds an evidence pack per company: every number with an id, source and date.
2. Three analysts (fundamentals, markets and news, client fit) each see only their slice and must cite ids.
3. Code checks every answer: valid shape, real ids, every number matches the evidence within 1%, at least one pro and one con, no dashes. One retry with the errors listed, then a summary built directly from the data, labelled as such.
4. Code makes the decision: hard rules always win, analysts can move the score by at most 5 points and can flag disagreement.
5. Follow up questions use the same evidence and the same number check; if a number can't be confirmed the answer says so.
6. Learning without training: corrections to rules are remembered and applied (exact phrase confirmed twice) or used as examples; swipes shift personal score weights. The trust panel shows the live correction rate, numbers checked, numbers blocked and the eval before and after accuracy.

## Demo

8 minutes. Script and persona in `docs/MASTER_PROMPT.md`. UI target in `docs/mandate-mock.html` (open in a browser).
