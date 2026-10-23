// Turns the form and the client's own words into numbered rules. Form fields map directly; free text goes
// through the LLM (with remembered corrections as examples) and a keyword parser as the fallback.
import type { AppRule, FormInput } from "../types";
import { EXCLUDE_GROUPS, THEMES } from "../types";
import type { Correction } from "../server/db";

const ALL_TAGS = Object.values(EXCLUDE_GROUPS).flat();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const TAG_WORDS: Record<string, string[]> = {
  Tobacco: ["tobacco", "cigarette", "cigarettes", "smoking"], Alcohol: ["alcohol", "booze", "beer", "spirits"],
  Gambling: ["gambling", "casino", "casinos", "betting"], Adult: ["adult entertainment", "adult"], Weapons: ["weapons", "arms", "defence", "defense", "guns"],
  "Fossil fuels": ["fossil fuels", "fossil", "oil", "gas companies"], Coal: ["coal"], Mining: ["mining", "miners"],
  "China listed": ["china", "chinese"], "Emerging markets": ["emerging markets"], "Crypto exposed": ["crypto", "bitcoin"],
  "Leveraged ETFs": ["leveraged"], "Penny stocks": ["penny stocks"], "High debt": ["lots of debt", "high debt", "heavily indebted"],
};
const THEME_WORDS: Record<string, string[]> = {
  Healthcare: ["healthcare", "health care", "medical", "pharma", "health"], Technology: ["technology", "tech"], "AI and software": ["ai", "software", "artificial intelligence"],
  Biotech: ["biotech"], Financials: ["banks", "financials", "finance"], "Clean energy": ["clean energy", "renewables", "renewable", "solar", "green energy"],
  Utilities: ["utilities"], "Real estate": ["real estate", "property"], Energy: ["energy"], Industrials: ["industrials", "industry"],
  Materials: ["materials"], Communication: ["media", "telecoms", "communication"], "Consumer staples": ["consumer staples", "everyday brands"],
  "Consumer discretionary": ["retail", "consumer discretionary"], "Dividend payers": [],
};
const HARD_WORDS = /\b(no|not|never|don't|dont|can't|cant|cannot|won't|must|at most|no more than|avoid|exclude|need)\b/i;
const NEG_WORDS = /\b(no|not|never|don't|dont|avoid|exclude|without|nothing in|stay away)\b/i;
const LIKE_WORDS = /\b(like|interested|prefer|love|keen|favour|favor|want|enjoy|rather)\b/i;
const hasWord = (s: string, w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s);

export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export function formRules(f: FormInput): AppRule[] {
  const r: AppRule[] = [
    { id: "", text: `Investing for ${f.horizon} years (${f.purpose.toLowerCase()})`, kind: "hard", field: "horizon_years", op: "==", value: f.horizon,
      source: "form", kindReason: "From your retirement age and goal on the form", confidence: 1 },
    { id: "", text: f.maxHolding === "AI" ? "Max per holding chosen by AI" : `No more than ${f.maxHolding}% in any one company`, kind: "hard",
      field: "max_holding_pct", op: "<=", value: f.maxHolding, source: "form", kindReason: "You chose it on the form", confidence: 1 },
  ];
  for (const tag of f.exclude) r.push({ id: "", text: `Exclude ${tag.toLowerCase()}`, kind: "hard", field: "exclude_tag", op: "not_in", value: [tag],
    source: "form", kindReason: "You ticked it under Exclude, so it is a hard rule", confidence: 1 });
  if (f.favour.length) r.push({ id: "", text: `Favour ${f.favour.join(", ").toLowerCase()}`, kind: "soft", field: "favour_sector", op: "in", value: f.favour,
    source: "form", kindReason: "Favourites add points but never rule a company out", confidence: 1 });
  return r;
}

/** Keyword parser. Always available, so the app works with no LLM. Quotes are whole sentences from the text. */
export function keywordRules(text: string, amount = 100_000): AppRule[] {
  const out: AppRule[] = [];
  for (const s of sentences(text)) {
    const loss = s.match(/(?:lose|losing|loss of|drop of|fall of|down)\D{0,40}?(\d+(?:\.\d+)?)\s*(%|percent|k\b|,000|thousand)?/i);
    if (loss) {
      const n = parseFloat(loss[1]);
      const unit = (loss[2] || "").toLowerCase();
      const dollars = unit === "%" || unit === "percent" || (!unit && n <= 100) ? (amount * n) / 100 : unit ? n * 1000 : n;
      out.push({ id: "", text: `Bad year loss at most $${Math.round(dollars).toLocaleString("en-US")}`, kind: HARD_WORDS.test(s) ? "hard" : "soft",
        field: "max_bad_year_loss", op: "<=", value: Math.round(dollars), source: "text", quote: s,
        kindReason: HARD_WORDS.test(s) ? `Hard because you said "${s.match(HARD_WORDS)![0]}"` : "A preference, because you didn't say it was a must", confidence: 0.8 });
    }
    if (NEG_WORDS.test(s)) {
      for (const [tag, words] of Object.entries(TAG_WORDS)) {
        if (words.some((w) => hasWord(s, w))) out.push({ id: "", text: `Exclude ${tag.toLowerCase()}`, kind: "hard", field: "exclude_tag", op: "not_in", value: [tag],
          source: "text", quote: s, kindReason: `Hard because you said "${s.match(NEG_WORDS)![0]}"`, confidence: 0.85 });
      }
    }
    if (/dividend|income/i.test(s) && !NEG_WORDS.test(s)) {
      const hard = /\b(need|must|only)\b/i.test(s);
      out.push({ id: "", text: "Prefer companies paying at least a 2% dividend", kind: hard ? "hard" : "soft", field: "min_dividend_yield", op: ">=", value: 2,
        source: "text", quote: s, kindReason: hard ? "Hard because you said you need it" : `A preference, because you said "${(s.match(LIKE_WORDS) || ["like"])[0]}"`, confidence: 0.75 });
    }
    if (/profitable|make money|making money/i.test(s) && !/\bnot\b.*profitable/i.test(s)) {
      const hard = /\b(only|must)\b/i.test(s);
      out.push({ id: "", text: "Prefer profitable companies", kind: hard ? "hard" : "soft", field: "profitable", op: "==", value: true, source: "text", quote: s,
        kindReason: hard ? "Hard because you said only or must" : "A preference, because you said rather or prefer", confidence: 0.75 });
    }
    if (LIKE_WORDS.test(s) && !NEG_WORDS.test(s)) {
      const themes = Object.entries(THEME_WORDS).filter(([, ws]) => ws.some((w) => hasWord(s, w))).map(([t]) => t);
      if (themes.length) out.push({ id: "", text: `Favour ${themes.join(", ").toLowerCase()}`, kind: "soft", field: "favour_sector", op: "in", value: themes,
        source: "text", quote: s, kindReason: `A preference, because you said "${s.match(LIKE_WORDS)![0]}"`, confidence: 0.75 });
    }
  }
  return out;
}

export const PARSE_SYSTEM = `You turn an investor's own words into rules. Reply with JSON only: {"rules":[{"text":string,"kind":"hard"|"soft","field":string,"op":string,"value":any,"quote":string,"kindReason":string,"confidence":number}]}
Fields: max_bad_year_loss (value in dollars of a $100,000 portfolio), exclude_tag (value: list from ${JSON.stringify(ALL_TAGS)}), favour_sector (value: list from ${JSON.stringify(THEMES)}), min_dividend_yield (percent), profitable (true), max_volatility (percent), note (anything that cannot be checked with market data).
Hard or soft: "never, no, don't, can't, must, at most, not more than, need" mean hard. "prefer, like, rather, ideally, interested in, would be nice" mean soft.
"quote" must be copied exactly from the investor's words. kindReason explains in plain English why it is hard or soft, quoting the deciding word. No dashes as punctuation.`;

export function jaccard(a: string, b: string) {
  const A = new Set(norm(a).split(" ")), B = new Set(norm(b).split(" "));
  const inter = Array.from(A).filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter || 1);
}

export function similarCorrections(text: string, corrections: Correction[], k = 5) {
  return corrections.map((c) => ({ c, s: Math.max(...sentences(text).map((x) => jaccard(x, c.phrase)), 0) }))
    .filter((x) => x.s > 0.2).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.c);
}

export function fewShot(examples: Correction[]) {
  return examples.length
    ? `\nEarlier users corrected these. Follow them:\n${examples.map((e) => `Wrote "${e.phrase}" and confirmed it means ${JSON.stringify(e.rule)}`).join("\n")}`
    : "";
}

/** Keep only well formed LLM rules whose quote really appears in the text. */
export function cleanLlmRules(raw: unknown, text: string): AppRule[] {
  const list = (raw as { rules?: unknown[] })?.rules;
  if (!Array.isArray(list)) return [];
  const fields = new Set(["max_bad_year_loss", "exclude_tag", "favour_sector", "min_dividend_yield", "profitable", "max_volatility", "note"]);
  const out: AppRule[] = [];
  for (const r of list as Record<string, any>[]) {
    if (!r || !fields.has(r.field) || typeof r.quote !== "string" || !norm(text).includes(norm(r.quote))) continue;
    let value = r.value;
    if (r.field === "exclude_tag") value = (Array.isArray(value) ? value : [value]).filter((v: string) => ALL_TAGS.includes(v));
    if (r.field === "favour_sector") value = (Array.isArray(value) ? value : [value]).filter((v: string) => THEMES.includes(v));
    if (Array.isArray(value) && !value.length) continue;
    out.push({ id: "", text: String(r.text || "").replace(/[\u2013\u2014]/g, ","), kind: r.kind === "hard" ? "hard" : "soft", field: r.field, op: r.op || "==",
      value, source: "text", quote: r.quote, kindReason: String(r.kindReason || ""), confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.7)) });
  }
  return out;
}

/** Remembered corrections win: a phrase corrected the same way at least twice is applied directly. */
export function applyMemory(rules: AppRule[], text: string, corrections: Correction[]): AppRule[] {
  const strong = corrections.filter((c) => c.timesConfirmed >= 2);
  const out = rules.map((r) => {
    const hit = r.quote && strong.find((c) => norm(c.phrase) === norm(r.quote!) && c.rule.field === r.field);
    return hit ? { ...r, kind: hit.rule.kind, value: hit.rule.value, text: hit.rule.text, kindReason: `Learned from ${hit.timesConfirmed} earlier corrections`, learnedFrom: hit.timesConfirmed } : r;
  });
  for (const s of sentences(text)) {
    for (const c of strong.filter((c) => norm(c.phrase) === norm(s))) {
      if (!out.some((r) => r.quote && norm(r.quote) === norm(s) && r.field === c.rule.field)) {
        out.push({ id: "", ...c.rule, op: c.rule.op as AppRule["op"], field: c.rule.field as AppRule["field"], source: "text", quote: s,
          kindReason: `Learned from ${c.timesConfirmed} earlier corrections`, confidence: 0.9, learnedFrom: c.timesConfirmed });
      }
    }
  }
  return out;
}

/** Merge form and text rules, drop duplicates, number them C1..Cn. */
export function mergeRules(form: AppRule[], text: AppRule[]): AppRule[] {
  const out = [...form];
  const formTags = new Set(form.filter((r) => r.field === "exclude_tag").flatMap((r) => r.value as string[]));
  for (const r of text) {
    if (r.field === "exclude_tag") {
      const tags = (r.value as string[]).filter((t) => !formTags.has(t));
      for (const t of tags) {
        if (!out.some((x) => x.field === "exclude_tag" && (x.value as string[]).includes(t))) out.push({ ...r, value: [t], text: `Exclude ${t.toLowerCase()}` });
      }
      continue;
    }
    const same = out.find((x) => x.field === r.field && x.source === "text");
    if (same && r.field !== "note") continue;
    if (r.field === "favour_sector") {
      const formFav = out.find((x) => x.field === "favour_sector" && x.source === "form");
      const extra = (r.value as string[]).filter((t) => !((formFav?.value as string[]) || []).includes(t));
      if (!extra.length) continue;
      out.push({ ...r, value: extra, text: `Favour ${extra.join(", ").toLowerCase()}` });
      continue;
    }
    out.push(r);
  }
  return out.map((r, i) => ({ ...r, id: `C${i + 1}` }));
}
