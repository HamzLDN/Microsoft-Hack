// Code checks on every analyst output: shape, real evidence ids, numbers that match the data, pros and cons.
import { AnalystOutput } from "@shared/contract";
import type { Evidence } from "../types";

export function extractNumbers(text: string): number[] {
  const clean = text.replace(/\*\*/g, "").replace(/(\d),(?=\d{3}\b)/g, "$1");
  const out: number[] = [];
  for (const m of clean.matchAll(/(?<![A-Za-z])-?\$?(\d+(?:\.\d+)?)\s*(%|x\b|times|billion|bn|k\b)?/gi)) {
    const n = parseFloat(m[1]);
    const neg = m[0].trim().startsWith("-");
    out.push(neg ? -n : n);
  }
  return out;
}

/** Numbers an analyst may write: evidence values (and their absolute and rounded forms) plus extras like the dollar amount. */
export function allowedNumbers(evidence: Evidence[], extras: number[] = []): number[] {
  const vals = [...evidence.map((e) => e.value), ...extras];
  return vals.flatMap((v) => [v, Math.abs(v), Math.round(v), Math.round(Math.abs(v))]);
}

export function numberSupported(n: number, allowed: number[]): boolean {
  if (Number.isInteger(n) && ((n >= 0 && n <= 12) || (n >= 1900 && n <= 2100))) return true; // small counts and years
  return allowed.some((a) => Math.abs(a - n) <= Math.max(0.051, Math.abs(a) * 0.01) || Math.abs(Math.abs(a) - Math.abs(n)) <= Math.max(0.051, Math.abs(a) * 0.01));
}

export type Check = { ok: boolean; errors: string[]; numbersChecked: number; unsupported: number[] };

export function validateAnalyst(raw: unknown, agent: string, evidence: Evidence[], extras: number[] = [], need: { pro?: boolean; con?: boolean } = { pro: true, con: true }): Check & { value?: AnalystOutput } {
  const parsed = AnalystOutput.safeParse({ ...(raw as object), agent, fallback: false });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), numbersChecked: 0, unsupported: [] };
  }
  const out = parsed.data;
  const ids = new Set(evidence.map((e) => e.id));
  const allowed = allowedNumbers(evidence, extras);
  const errors: string[] = [];
  let checked = 0;
  const unsupported: number[] = [];
  for (const p of out.points) {
    for (const id of p.evidenceIds) if (!ids.has(id)) errors.push(`Unknown evidence id ${id}`);
    for (const n of extractNumbers(p.text)) {
      checked++;
      if (!numberSupported(n, allowed)) unsupported.push(n);
    }
    if (/[\u2013\u2014]/.test(p.text)) errors.push("Uses a dash as punctuation");
  }
  for (const n of extractNumbers(out.summary)) {
    checked++;
    if (!numberSupported(n, allowed)) unsupported.push(n);
  }
  if (unsupported.length) errors.push(`Numbers not in the evidence: ${unsupported.join(", ")}`);
  if (need.pro && !out.points.some((p) => p.polarity === "pro")) errors.push("Needs at least one pro");
  if (need.con && !out.points.some((p) => p.polarity === "con")) errors.push("Needs at least one con");
  for (const p of out.points) if (!p.evidenceIds.length) errors.push(`Claim without a citation: ${p.text.slice(0, 60)}`);
  return { ok: errors.length === 0, errors, numbersChecked: checked, unsupported, value: out };
}

export function stripDashes(s: string) {
  return s.replace(/\s*[\u2013\u2014]\s*/g, ", ");
}

/** Removes evidence codes like [E3] or [A1,A2,R5] from prose; they belong in the evidence chips, not the sentence. */
export function cleanProse(s: string) {
  return stripDashes(s.replace(/\s*\[(?:[A-Z]\d{1,2}\s*,?\s*)+\]/g, "").replace(/\b(\d[\d,]*) dollars\b/g, (_, n) => `$${Number(n.replace(/,/g, "")).toLocaleString("en-US")}`)).replace(/\s+([.,;])/g, "$1");
}
