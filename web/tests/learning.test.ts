import { describe, expect, it } from "vitest";
import { decide } from "@/lib/decision";
import { applySwipe, correctionRate, personalWeights } from "@/lib/learning";
import type { AnalystOutput, Candidate, Rule } from "@/lib/types";

describe("learning", () => {
  it("swipes move weights toward what the user owns, within plus or minus 10", () => {
    let l = { weightAdjust: {}, notes: [] as string[] };
    for (let i = 0; i < 10; i++) l = applySwipe(l, true, [{ name: "Stability", value: 100 }, { name: "Growth", value: 0 }]);
    expect(l.weightAdjust).toMatchObject({ Stability: 10, Growth: -10 });
    expect(l.notes[0]).toMatch(/You value/);
  });
  it("personal weights never go negative", () => {
    expect(personalWeights({ Growth: 5 }, { weightAdjust: { Growth: -10 }, notes: [] }).Growth).toBe(0);
  });
  it("correction rate", () => {
    expect(correctionRate([{ parsed: 4, corrected: 1 }, { parsed: 6, corrected: 0 }])).toBe(10);
    expect(correctionRate([])).toBeNull();
  });
});

describe("decision", () => {
  const rules = [{ id: "C1", kind: "hard" }, { id: "C2", kind: "soft" }] as Rule[];
  const cand = (pass: boolean, status: "included" | "excluded") => ({ ticker: "X", name: "X", amount: 5000, status, mainReason: "r", pros: [{ text: "good", evidenceIds: [] }],
    cons: [], checks: [{ ruleId: "C1", pass, detail: "" }], score: { total: 70, parts: [], ruleAdjustments: [] } }) as unknown as Candidate;
  const out = (stance: "include" | "exclude"): AnalystOutput => ({ agent: "judge", stance, confidence: 1, points: [], summary: "", fallback: false });
  it("a hard rule fail always excludes, whatever the analysts say", () => {
    expect(decide(cand(false, "included"), [out("include"), out("include"), out("include")], rules).include).toBe(false);
  });
  it("analysts nudge the score by at most 5 and flag disagreement", () => {
    const d = decide(cand(true, "included"), [out("exclude"), out("exclude"), out("exclude")], rules);
    expect(d.include).toBe(true);
    expect(d.scoreNudge).toBe(-5);
    expect(d.disagree).toBe(true);
  });
});

describe("learning notes", () => {
  it("keeps one note per score part", () => {
    let l = { weightAdjust: {}, notes: [] as string[] };
    l = applySwipe(l, true, [{ name: "Income", value: 100 }]);
    l = applySwipe(l, true, [{ name: "Income", value: 100 }]);
    expect(l.notes.filter((n) => n.startsWith("You value Income"))).toHaveLength(1);
  });
});
