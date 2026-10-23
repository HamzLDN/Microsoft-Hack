import { lookup } from "@/lib/ai/glossary";
import { flask } from "@/lib/server/flask";
import { confidentMatch, extractTickerSymbol, searchUniverse, type UniverseEntry } from "./universeSearch";

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

/** Questions about why or what a term means should not be replaced by a price. */
const SKIP_QUOTE = /\b(why|should|explain|mean|meaning|because|define|risk|rule)\b/i;

export function wantsLiveMarketData(query: string): boolean {
  return PRICE_INTENT.test(query) || /\b(ticker|etf|stock|shares?)\b/i.test(query);
}

async function loadUniverse(): Promise<UniverseEntry[]> {
  const u = await flask<{ tickers?: UniverseEntry[] }>("/universe");
  return u.tickers ?? [];
}

async function quoteOf(ticker: string, name: string): Promise<QuoteResult> {
  const q = await flask<QuoteResponse>(`/quote/${encodeURIComponent(ticker)}`);
  return { ticker: q.ticker, name, price: q.price, change: q.change, changePct: q.changePct, source: q.source, live: q.live };
}

/**
 * Resolve a name or ticker against the data service.
 * Returns null when the question is not a quote request, so the assistant can answer it another way.
 */
export async function resolveAndQuote(
  query: string,
): Promise<QuoteResult | { error?: string; suggestions?: UniverseHit[] } | null> {
  if (lookup(query) && !PRICE_INTENT.test(query)) return null;
  if (SKIP_QUOTE.test(query)) return null;
  const entries = await loadUniverse();
  const known = new Set(entries.map((e) => e.ticker));
  const explicit = extractTickerSymbol(query, known);
  const priceAsk = wantsLiveMarketData(query);
  const shortAsk = query.trim().split(/\s+/).filter(Boolean).length <= 8;
  const allow = priceAsk || shortAsk || Boolean(explicit);
  if (!allow) return null;

  if (explicit && known.has(explicit) && allow) {
    const name = entries.find((e) => e.ticker === explicit)?.name ?? explicit;
    try {
      return await quoteOf(explicit, name);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  const decision = confidentMatch(query, entries);
  if (decision.kind === "many" && allow) {
    return { suggestions: decision.entries.map((e) => ({ ticker: e.ticker, name: e.name })) };
  }
  if (decision.kind === "one" && allow) {
    try {
      return await quoteOf(decision.entry.ticker, decision.entry.name);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  if (!priceAsk) return null;
  const hits = searchUniverse(query, entries, 5).filter((h) => h.score >= 4);
  if (!hits.length) return { error: "I couldn't match that to a stock or ETF in Bettervest." };
  if (hits.length === 1 || hits[0].score >= (hits[1]?.score ?? 0) + 3) {
    try {
      return await quoteOf(hits[0].entry.ticker, hits[0].entry.name);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
  return { suggestions: hits.map((h) => ({ ticker: h.entry.ticker, name: h.entry.name })) };
}

export function formatQuoteReply(q: QuoteResult): string {
  const move =
    q.changePct != null && q.change != null
      ? ` (${q.change >= 0 ? "+" : ""}${q.change}, ${q.changePct >= 0 ? "+" : ""}${q.changePct}% today)`
      : "";
  const live = q.live ? "live" : "last close from cache";
  return `**${q.name} (${q.ticker})** is **$${q.price.toFixed(2)}**${move}. Source: **${q.source}** (${live}). This is market data, not advice.`;
}
