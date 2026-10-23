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
    expect(validateAnalyst(good, "bull", ev).ok).toBe(true);
  });
  it("catches an invented number", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[1], text: "Sales grew **37.5%**." }] };
    const r = validateAnalyst(bad, "bull", ev);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain(37.5);
  });
  it("catches a missing evidence id", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[1], evidenceIds: ["E99"] }] };
    expect(validateAnalyst(bad, "bull", ev).errors.join()).toMatch(/E99/);
  });
  it("requires a pro and a con", () => {
    const bad = { ...good, points: [good.points[0], { ...good.points[0] }] };
    expect(validateAnalyst(bad, "bull", ev).errors.join()).toMatch(/con/);
  });
  it("rejects malformed shapes", () => {
    expect(validateAnalyst({ stance: "maybe" }, "bull", ev).ok).toBe(false);
  });
});

import { fallback } from "@/lib/ai/analysts";
describe("data fallback", () => {
  it("bull argues for, bear argues against, at most 5 points, every claim cited", () => {
    const c = { ticker: "X", name: "X", sector: "S", type: "stock", status: "included", amount: 8700, mainReason: "", pros: [], cons: [], checks: [],
      score: { total: 70, parts: [], ruleAdjustments: [] } } as any;
    const ev = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `R${i}`, ticker: "X", label: `C${i} rule: passes. ok`, value: 1, unit: "count", source: "Engine", asOf: "now" }) as const)
      .concat([{ id: "A1", ticker: "X", label: "Amount", value: 8700, unit: "$", source: "Engine", asOf: "now" } as any, { id: "A2", ticker: "X", label: "Loss", value: 14000, unit: "$", source: "Engine", asOf: "now" } as any]);
    const market = [{ id: "E3", value: 31, unit: "%" }, { id: "E6", value: 40, unit: "x" }, { id: "E9", value: 22, unit: "%" }, { id: "E7", value: 3, unit: "%" }]
      .map((e) => ({ ...e, ticker: "X", label: e.id, source: "yfinance", asOf: "now" }));
    const bull = fallback("bull", c, [...ev, ...market] as any), bear = fallback("bear", c, [...ev, ...market] as any);
    expect(bull.points.filter((p) => p.polarity === "pro").length).toBeGreaterThanOrEqual(2);
    expect(bear.points.filter((p) => p.polarity === "con").length).toBeGreaterThanOrEqual(2);
    for (const o of [bull, bear]) { expect(o.points.length).toBeLessThanOrEqual(5); for (const p of o.points) expect(p.evidenceIds.length).toBeGreaterThan(0); }
  });
});

import { cleanProse } from "@/lib/ai/guardrails";
describe("clean prose", () => {
  it("removes evidence codes and formats dollars", () => {
    expect(cleanProse("I support **6400 dollars** here [A1,A2,R5]. Yield is 5.7% [E7].")).toBe("I support **$6,400** here. Yield is 5.7%.");
  });
});
