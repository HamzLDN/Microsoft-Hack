// Measures rule extraction accuracy on a fixed set of sentences, before and after remembered corrections.
// Uses the LLM when one is configured, otherwise the keyword parser. Writes eval-results.json for the trust panel.
import fs from "node:fs";
import path from "node:path";

for (const line of (() => { try { return fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8").split("\n"); } catch { return []; } })()) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

import { applyMemory, cleanLlmRules, keywordRules, PARSE_SYSTEM } from "../lib/ai/parser";
import { callJSON, llmConfigured } from "../lib/ai/llm";
import type { Correction } from "../lib/server/db";

type Case = { text: string; expect: { field: string; kind: "hard" | "soft"; value?: unknown }[] };
const CASES: Case[] = [
  { text: "I can't stomach losing more than about 15% in a bad year.", expect: [{ field: "max_bad_year_loss", kind: "hard", value: 15000 }] },
  { text: "No gambling or tobacco.", expect: [{ field: "exclude_tag", kind: "hard", value: ["Gambling"] }, { field: "exclude_tag", kind: "hard", value: ["Tobacco"] }] },
  { text: "I like companies that pay dividends.", expect: [{ field: "min_dividend_yield", kind: "soft" }] },
  { text: "I'm interested in healthcare.", expect: [{ field: "favour_sector", kind: "soft", value: ["Healthcare"] }] },
  { text: "I'd rather own profitable companies.", expect: [{ field: "profitable", kind: "soft" }] },
  { text: "Never put my money into weapons makers.", expect: [{ field: "exclude_tag", kind: "hard", value: ["Weapons"] }] },
  { text: "I need income from dividends.", expect: [{ field: "min_dividend_yield", kind: "hard" }] },
  { text: "Avoid oil companies.", expect: [{ field: "exclude_tag", kind: "hard", value: ["Fossil fuels"] }] },
  { text: "I love clean energy and renewables.", expect: [{ field: "favour_sector", kind: "soft", value: ["Clean energy"] }] },
  { text: "I don't want to lose more than $10k.", expect: [{ field: "max_bad_year_loss", kind: "hard", value: 10000 }] },
  { text: "I'd like some tech exposure.", expect: [{ field: "favour_sector", kind: "hard", value: ["Technology"] }] }, // corrected to hard by users
  { text: "No crypto please.", expect: [{ field: "exclude_tag", kind: "hard", value: ["Crypto exposed"] }] },
];
const CORRECTIONS: Correction[] = [
  { phrase: "I'd like some tech exposure.", rule: { field: "favour_sector", kind: "hard", value: ["Technology"], text: "Must include technology", op: "in" }, timesConfirmed: 2, updatedAt: "" },
];

async function parse(text: string, memory: Correction[]) {
  let rules = keywordRules(text);
  if (llmConfigured()) {
    try { const llm = cleanLlmRules((await callJSON(PARSE_SYSTEM, text)).data, text); if (llm.length) rules = llm; } catch {}
  }
  return applyMemory(rules, text, memory);
}

function score(rules: Awaited<ReturnType<typeof parse>>, c: Case) {
  return c.expect.filter((e) => rules.some((r) => r.field === e.field && r.kind === e.kind &&
    (e.value === undefined || JSON.stringify(Array.isArray(e.value) ? e.value : e.value) === JSON.stringify(Array.isArray(e.value) ? (r.value as string[]).filter((v) => (e.value as string[]).includes(v)) : r.value)))).length;
}

(async () => {
  const total = CASES.reduce((s, c) => s + c.expect.length, 0);
  let before = 0, after = 0;
  const rows = [];
  for (const c of CASES) {
    const b = score(await parse(c.text, []), c), a = score(await parse(c.text, CORRECTIONS), c);
    before += b; after += a;
    rows.push({ text: c.text, expected: c.expect.length, before: b, after: a });
  }
  const out = { at: new Date().toISOString(), method: llmConfigured() ? "llm" : "keywords", expectedRules: total,
    ruleAccuracy: { before: Math.round((before / total) * 1000) / 10, after: Math.round((after / total) * 1000) / 10 }, cases: rows };
  fs.writeFileSync(path.join(__dirname, "..", "eval-results.json"), JSON.stringify(out, null, 2));
  console.log(`Rule accuracy (${out.method}): ${out.ruleAccuracy.before}% before learning, ${out.ruleAccuracy.after}% after`);
  for (const r of rows.filter((r) => r.after < r.expected)) console.log(`  missed: ${r.text}`);
})();
