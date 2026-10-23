import { describe, expect, it } from "vitest";
import { runIC, stancesOf, verdictEffect } from "@/lib/ai/ic";
import { allowedNumbers, extractNumbers, numberSupported } from "@/lib/ai/guardrails";

// No AI key in tests, so the pipeline runs in data rules mode
const ev = [
  { id: "E2", value: 4, unit: "%" }, { id: "E3", value: 31.2, unit: "%" }, { id: "E4", value: -22, unit: "%" }, { id: "E6", value: 45.5, unit: "x" },
  { id: "E7", value: 3.1, unit: "%" }, { id: "E8", value: 9, unit: "%" }, { id: "E9", value: 24, unit: "%" }, { id: "E11", value: 300, unit: "$" },
].map((e) => ({ ...e, ticker: "X", label: e.id, source: "yfinance", asOf: "now" })) as any;
const rules = [{ id: "C1", kind: "hard", text: "Exclude tobacco" }, { id: "C2", kind: "soft", text: "Favour healthcare" }] as any;
const cand = (pass: boolean) => ({ ticker: "X", name: "Example Co", sector: "Health", type: "stock", status: "included", amount: 6000, mainReason: "",
  pros: [], cons: [], score: { total: 70, parts: [], ruleAdjustments: [] }, checks: [{ ruleId: "C1", pass, detail: pass ? "ok" : "Involved in: Tobacco" }, { ruleId: "C2", pass: true, detail: "ok" }] }) as any;

describe("investment committee pipeline", () => {
  it("a hard rule breach trips the compliance circuit breaker before any debate", async () => {
    const ic = await runIC(cand(false), rules, ev, "client");
    expect(ic.halted?.code).toBe("COMPLIANCE_BLOCK");
    expect(ic.verdict.decision).toBe("REJECTED");
    expect(ic.rounds).toHaveLength(0);
    expect(verdictEffect(ic, true).out).toBe(true);
  });
  it("runs both theses, two cited rebuttal rounds and a verdict", async () => {
    const ic = await runIC(cand(true), rules, ev, "client");
    expect(ic.halted).toBeNull();
    expect(ic.theses.bull && ic.theses.bear).toBeTruthy();
    expect(ic.rounds.map((r) => r.round)).toEqual([1, 2]);
    const turns = ic.rounds.flatMap((r) => r.turns);
    expect(new Set(turns.map((t) => t.from))).toEqual(new Set(["bull", "bear"]));
    const allowed = allowedNumbers(ev);
    for (const t of turns) { expect(t.cited).toBe(true); for (const n of extractNumbers(t.text)) expect(numberSupported(n, allowed)).toBe(true); }
    expect(["BUY", "HOLD", "SELL"]).toContain(ic.verdict.decision);
    expect(ic.checks.every((c) => c.passed)).toBe(true);
    expect(Object.keys(stancesOf(ic))).toEqual(["bull", "bear", "judge"]);
  });
  it("verdicts change the portfolio", () => {
    const base = { mode: "ai", theses: {}, rounds: [], unreliable: [], checks: [], halted: null, models: [], numbersChecked: 0 } as any;
    expect(verdictEffect({ ...base, verdict: { decision: "SELL", confidence: 0.8 } }, true)).toEqual({ adjustment: 0, out: true });
    expect(verdictEffect({ ...base, verdict: { decision: "BUY", confidence: 1 } }, false).adjustment).toBe(15);
    expect(verdictEffect({ ...base, verdict: { decision: "HOLD", confidence: 0.5 } }, true)).toEqual({ adjustment: 0, out: false });
  });
});
