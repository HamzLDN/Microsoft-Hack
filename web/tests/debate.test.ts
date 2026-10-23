import { describe, expect, it } from "vitest";
import { fallbackDebate } from "@/lib/ai/debate";
import { allowedNumbers, extractNumbers, numberSupported } from "@/lib/ai/guardrails";

const ev = [
  { id: "E2", label: "Return", value: 42, unit: "%" }, { id: "E3", label: "Volatility", value: 31.2, unit: "%" },
  { id: "E6", label: "P/E", value: 45.5, unit: "x" }, { id: "E9", label: "FCF margin", value: 12, unit: "%" },
  { id: "R1", label: "C3 (preference) Favour healthcare: fails. Not in a favoured area", value: 0, unit: "count" },
].map((e) => ({ ...e, ticker: "X", source: "yfinance", asOf: "now" })) as any;
const out = (agent: string) => ({ agent, stance: "include", confidence: 0.6, points: [], summary: "", fallback: true }) as any;

describe("committee discussion (offline)", () => {
  const d = fallbackDebate({ ticker: "X", name: "X" } as any, [out("fundamentals"), out("markets"), out("fit")], ev);
  it("every analyst speaks, to someone else", () => {
    expect(new Set(d.turns.map((t) => t.from))).toEqual(new Set(["fundamentals", "markets", "fit"]));
    for (const t of d.turns) expect(t.to).not.toBe(t.from);
  });
  it("challenges use the evidence and only its numbers", () => {
    expect(d.turns.find((t) => t.from === "markets")!.kind).toBe("challenge");
    const allowed = allowedNumbers(ev);
    for (const t of d.turns) for (const n of extractNumbers(t.text)) expect(numberSupported(n, allowed)).toBe(true);
  });
  it("a failing client rule changes the fit analyst's final stance", () => {
    expect(d.finalStances.fit).toBe("neutral");
    expect(d.shifts.find((x) => x.agent === "fit")?.reason).toMatch(/fails/);
  });
});

import { committeeAdjustment } from "@/lib/ai/debate";
describe("discussion changes outcomes", () => {
  const r1 = ["fundamentals", "markets", "fit"].map((a) => ({ agent: a, stance: "include", confidence: 0.6, points: [], summary: "", fallback: true })) as any;
  it("a landed challenge moves the challenged analyst and lowers the committee score", () => {
    const d = fallbackDebate({ ticker: "X", name: "X" } as any, r1, ev);
    expect(d.shifts.length).toBeGreaterThan(0);
    const unchanged = { turns: [], shifts: [], fallback: true, finalStances: { fundamentals: "include", markets: "include", fit: "include" } } as any;
    expect(committeeAdjustment(r1, d)).toBeLessThan(committeeAdjustment(r1, unchanged));
  });
  it("two analysts against means a strong negative change", () => {
    const d = { turns: [], shifts: [], fallback: true, finalStances: { fundamentals: "exclude", markets: "exclude", fit: "include" } } as any;
    expect(committeeAdjustment(r1, d)).toBe(-15);
  });
});
