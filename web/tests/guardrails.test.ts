import { describe, expect, it } from "vitest";
import { extractNumbers, numberSupported, allowedNumbers, validateAnalyst } from "@/lib/ai/guardrails";
import type { Evidence } from "@/lib/types";

const ev: Evidence[] = [
  { id: "E3", ticker: "JNJ", label: "Volatility", value: 20.66, unit: "%", source: "yfinance", asOf: "2026-10-22" },
  { id: "E8", ticker: "JNJ", label: "Revenue growth", value: 5.9, unit: "%", source: "yfinance", asOf: "latest" },
  { id: "E11", ticker: "JNJ", label: "Market value", value: 644.91, unit: "$", source: "yfinance", asOf: "latest" },
];
const good = { stance: "include", confidence: 0.7, summary: "Steady.", points: [
  { text: "Volatility is only **20.7%**.", polarity: "pro", evidenceIds: ["E3"] },
  { text: "Sales grew just **5.9%**.", polarity: "con", evidenceIds: ["E8"] },
] };

describe("guardrails", () => {
  it("extracts numbers through bold, commas, money and percent", () => {
    expect(extractNumbers("**$12,500** and 20.7% and -3.5")).toEqual([12500, 20.7, -3.5]);
  });
  it("accepts numbers that match evidence after rounding, and small counts", () => {
    const allowed = allowedNumbers(ev);
    expect(numberSupported(20.7, allowed)).toBe(true);
    expect(numberSupported(645, allowed)).toBe(true);
    expect(numberSupported(3, allowed)).toBe(true);
    expect(numberSupported(37.5, allowed)).toBe(false);
  });
  it("passes a valid output", () => {
    expect(validateAnalyst(good, "fundamentals", ev).ok).toBe(true);
  });
  it("catches an invented number", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[1], text: "Sales grew **37.5%**." }] };
    const r = validateAnalyst(bad, "fundamentals", ev);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain(37.5);
  });
  it("catches a missing evidence id", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[1], evidenceIds: ["E99"] }] };
    expect(validateAnalyst(bad, "fundamentals", ev).errors.join()).toMatch(/E99/);
  });
  it("requires a pro and a con", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[0] }] };
    expect(validateAnalyst(bad, "fundamentals", ev).errors.join()).toMatch(/con/);
  });
  it("rejects malformed shapes", () => {
    expect(validateAnalyst({ stance: "maybe" }, "fundamentals", ev).ok).toBe(false);
  });
});

import { fallback } from "@/lib/ai/analysts";
describe("data fallback", () => {
  it("always returns at least one pro and one con, at most 5 points", () => {
    const c = { ticker: "X", name: "X", sector: "S", type: "stock", status: "included", amount: 8700, mainReason: "", pros: [], cons: [], checks: [],
      score: { total: 70, parts: [], ruleAdjustments: [] } } as any;
    const ev = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `R${i}`, ticker: "X", label: `C${i} rule: passes. ok`, value: 1, unit: "count", source: "Engine", asOf: "now" }) as const)
      .concat([{ id: "A1", ticker: "X", label: "Amount", value: 8700, unit: "$", source: "Engine", asOf: "now" } as any, { id: "A2", ticker: "X", label: "Loss", value: 14000, unit: "$", source: "Engine", asOf: "now" } as any]);
    const out = fallback("fit", c, ev as any);
    expect(out.points.some((p) => p.polarity === "pro")).toBe(true);
    expect(out.points.some((p) => p.polarity === "con")).toBe(true);
    expect(out.points.length).toBeLessThanOrEqual(5);
  });
});
