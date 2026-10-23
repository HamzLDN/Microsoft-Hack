import { extractTickerSymbol } from "./universeSearch";
import { callMcpTool } from "./client";

export type QuoteResult = {
  ticker: string;
  name: string;
  price: number;
  change?: number;
  changePct?: number;
  source: string;
  live: boolean;
};

type UniverseHit = { ticker: string; name: string; matchScore?: number };
type QuoteResponse = { ticker: string; price: number; change?: number; changePct?: number; source: string; live: boolean };

const PRICE_INTENT =
  /\b(price|priced|quote|trading|cost|worth|share price|stock price|current|how much|what(?:'s| is) .{0,24}(?:at|for))\b/i;

export function wantsLiveMarketData(query: string): boolean {
  return PRICE_INTENT.test(query) || /\b(ticker|etf|stock|shares?)\b/i.test(query);
}

/** Resolve a fuzzy name or ticker via MCP, then fetch quote via MCP. */
export async function resolveAndQuote(
  query: string,
): Promise<QuoteResult | { error: string; suggestions?: UniverseHit[] }> {
  const explicit = extractTickerSymbol(query);
  let ticker = explicit;
  let name = ticker ?? "";
  let suggestions: UniverseHit[] | undefined;

  const pickFromSearch = async (text: string) => {
    const hits = await callMcpTool<UniverseHit[]>("search_universe", { query: text });
    suggestions = hits;
    if (!hits.length || (hits[0].matchScore ?? 0) < 4) return null;
    ticker = hits[0].ticker;
    name = hits[0].name;
    return hits[0].ticker;
  };

  if (ticker) {
    try {
      const q = await callMcpTool<QuoteResponse>("get_quote", { ticker });
      const hits = await callMcpTool<UniverseHit[]>("search_universe", { query: ticker });
      name = hits.find((h) => h.ticker === q.ticker)?.name ?? name;
      return { ticker: q.ticker, name, price: q.price, change: q.change, changePct: q.changePct, source: q.source, live: q.live };
    } catch {
      ticker = undefined;
    }
  }

  if (!(await pickFromSearch(query))) {
    return { error: "I couldn't match that to a stock or ETF in Mandate's universe.", suggestions };
  }

  try {
    const q = await callMcpTool<QuoteResponse>("get_quote", { ticker: ticker! });
    return { ticker: q.ticker, name, price: q.price, change: q.change, changePct: q.changePct, source: q.source, live: q.live };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export function formatQuoteReply(q: QuoteResult): string {
  const move =
    q.changePct != null && q.change != null
      ? ` (${q.change >= 0 ? "+" : ""}${q.change}, ${q.changePct >= 0 ? "+" : ""}${q.changePct}% today)`
      : "";
  const live = q.live ? "live" : "last close from cache";
  return `**${q.name} (${q.ticker})** is **$${q.price.toFixed(2)}**${move}. Source: **${q.source}** (${live}). This is market data, not advice.`;
}
