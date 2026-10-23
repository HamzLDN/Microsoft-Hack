# Mandate MCP server (server-side)

Small **stdio MCP server** used by the **Next.js chat API** (`web/lib/mcp/client.ts`). It is not for Cursor; the web app spawns this process and calls tools over MCP so the Help chat (and LLM tool loop) always use the data service for quotes and metrics.

Requires the Flask data service on port 5001.

## Tools

| Tool | Purpose |
|------|---------|
| `search_universe` | Fuzzy match names like "iShares TIPS" → `TIP` |
| `get_quote` | Live or cached price |
| `get_metrics` | Volatility, returns, ratios |
| `data_health` | Finnhub / yfinance / SEC / FRED status |

## Build

```bash
cd mcp-server && npm install && npm run build
```

`npm run dev` / `npm run build` in `web/` runs this automatically via `build:mcp`.

Optional: set `MANDATE_MCP_ENTRY` to a custom path to `dist/index.js`.
