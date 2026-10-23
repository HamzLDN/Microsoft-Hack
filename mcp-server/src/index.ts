#!/usr/bin/env node
/** MCP server: Bettervest data service tools for reliable quotes and metrics (Finnhub or yfinance via Flask). */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const BASE = process.env.DATA_SERVICE_URL || "http://localhost:5001";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

type UniverseEntry = { ticker: string; name: string; type?: string };

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((w) => w.length > 1);
}

function scoreQuery(query: string, entry: UniverseEntry): number {
  const q = tokens(query);
  let score = 0;
  const nameTok = tokens(entry.name);
  const ticker = entry.ticker.toLowerCase();
  for (const w of q) {
    if (w === ticker) score += 12;
    for (const n of nameTok) {
      if (n === w) score += 4;
      else if (n.includes(w) || w.includes(n)) score += 2;
    }
    if (w === "tips" && entry.ticker === "TIP") score += 6;
  }
  return score;
}

const server = new McpServer({ name: "mandate-data", version: "0.1.0" });

server.registerTool(
  "search_universe",
  {
    description: "Find tickers in Bettervest's investable universe by company or ETF name (fuzzy match).",
    inputSchema: { query: z.string().describe("Natural language, e.g. iShares TIPS bond") },
  },
  async ({ query }) => {
    const u = await api<{ tickers: UniverseEntry[] }>("/universe");
    const hits = u.tickers
      .map((entry) => ({ entry, score: scoreQuery(query, entry) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { content: [{ type: "text", text: JSON.stringify(hits.map((h) => ({ ...h.entry, matchScore: h.score })), null, 2) }] };
  },
);

server.registerTool(
  "get_quote",
  {
    description: "Current share price for a ticker in Bettervest's universe (Finnhub when configured, else cached yfinance).",
    inputSchema: { ticker: z.string().describe("Symbol, e.g. TIP") },
  },
  async ({ ticker }) => {
    const q = await api(`/quote/${encodeURIComponent(ticker.toUpperCase())}`);
    return { content: [{ type: "text", text: JSON.stringify(q, null, 2) }] };
  },
);

server.registerTool(
  "get_metrics",
  {
    description: "Key metrics for a ticker (volatility, returns, fundamentals) from the data service.",
    inputSchema: { ticker: z.string().describe("Symbol, e.g. TIP") },
  },
  async ({ ticker }) => {
    const m = await api(`/metrics/${encodeURIComponent(ticker.toUpperCase())}`);
    return { content: [{ type: "text", text: JSON.stringify(m, null, 2) }] };
  },
);

server.registerTool(
  "data_health",
  {
    description: "Which market data sources are active (Finnhub, SEC, FRED, yfinance).",
    inputSchema: {},
  },
  async () => {
    const h = await api("/health");
    return { content: [{ type: "text", text: JSON.stringify(h, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
