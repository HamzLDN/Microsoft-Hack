# Mandate

Your rules. Your portfolio. Every reason shown.

Mandate is a web app for an individual investor with $100,000. They state their goals and limits in a form and in their own words. Mandate turns these into numbered rules (C1, C2, ...), builds a portfolio of stocks and ETFs that follows them, and shows pros, cons and a pass or fail check against every rule for every company. Three AI analysts discuss each company, and the investor can question them.

Microsoft x LSEG London Hackathon 2026. Educational project. Not financial advice.

## Repo layout

| Folder | Owner | What |
|---|---|---|
| `data-service/` | Agent A | Flask (Python 3.11) on port 5001: market data, caching, metrics, scoring, portfolio engine |
| `web/` (API routes, `lib/ai`, `lib/db`, `prisma`) | Agent B | Next.js API: login, saved preferences, preference parsing, three AI analysts, chat |
| `web/` (pages, `components`) | Agent C | Next.js frontend |
| `shared/` | Everyone, change only together | Data contract (`contract.ts`, `contract.py`) and mock JSON |
| `docs/` | | Master plan, agent prompts, UI mock |

## Before the agents start (5 minutes)

1. Install Node 20+ and Python 3.11+ on each machine that runs an agent.
2. Get API keys and fill `.env` from `.env.example`:
   * Finnhub: free key at finnhub.io
   * FRED: free key at fred.stlouisfed.org
   * Azure OpenAI (or OpenAI): endpoint, key, deployment name
   * SEC EDGAR: no key, but set a contact email for the User-Agent header
3. Everyone pulls `main`. Agent B creates `web/` first (within 5 minutes) so Agent C does not create a second Next.js app.
4. Paste the matching file from `docs/prompts/` into each agent.

## Run

```bash
# data service
cd data-service && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python app.py      # http://localhost:5001

# web app
cd web && npm install && npx prisma db push && npm run dev   # http://localhost:3000
```

## Tests

```bash
cd data-service && pytest
cd web && npm test          # unit tests, LLM mocked
cd web && npm run eval      # prompt accuracy against the real LLM, writes eval-results.json
```

## Git rules for the three agents

* Only edit files in your own area. `shared/` changes are announced to the team first.
* Commit small and often. `git pull --rebase` before every push.
* Never commit `.env`.

## Demo

8 minutes. Script and persona in `docs/MASTER_PROMPT.md`. UI target in `docs/mandate-mock.html` (open in a browser).
