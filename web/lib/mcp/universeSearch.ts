export type UniverseEntry = { ticker: string; name: string; type?: string; sector?: string };

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function scoreQuery(query: string, entry: UniverseEntry): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const nameTok = tokens(entry.name);
  const ticker = entry.ticker.toLowerCase();
  let score = 0;
  for (const w of q) {
    if (w === ticker) score += 12;
    if (ticker.startsWith(w) || w.startsWith(ticker)) score += 4;
    for (const n of nameTok) {
      if (n === w) score += 4;
      else if (n.includes(w) || w.includes(n)) score += 2;
    }
    if (w === "tips" && entry.ticker === "TIP") score += 6;
    if ((w === "bond" || w === "bont" || w === "bonds") && entry.name.toLowerCase().includes("bond")) score += 2;
    if (w === "ishares" && entry.name.toLowerCase().includes("ishares")) score += 3;
  }
  return score;
}

/** Best match in Mandate's investable universe from a messy natural-language query. */
export function searchUniverse(query: string, entries: UniverseEntry[], limit = 3): { entry: UniverseEntry; score: number }[] {
  return entries
    .map((entry) => ({ entry, score: scoreQuery(query, entry) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const TICKER_STOP = new Set(["WHAT", "WHATS", "THE", "FOR", "AND", "ARE", "HOW", "CAN", "YOU", "STOCK", "SHARE", "PRICE", "CURRENT"]);

/** Only symbols typed in uppercase (e.g. TIP), so words like "tips" are not read as TIPS. */
export function extractTickerSymbol(query: string, known?: Set<string>): string | undefined {
  const m = query.match(/\b([A-Z]{1,5}(?:-[A-Z])?)\b/g);
  if (!m) return undefined;
  const candidates = m.filter((t) => !TICKER_STOP.has(t));
  if (known?.size) {
    const hit = candidates.find((t) => known.has(t));
    if (hit) return hit;
  }
  return candidates.length === 1 ? candidates[0] : candidates.find((t) => t.length >= 2 && t.length <= 5);
}
