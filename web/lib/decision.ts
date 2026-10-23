// The final decision is made in code. Analysts can nudge the score by at most 5 points and flag disagreement.
import type { AnalystOutput, Candidate, Rule } from "./types";

export type Decision = { include: boolean; scoreNudge: number; disagree: boolean; summary: string; pros: string[]; cons: string[] };

export function decide(c: Candidate, outputs: AnalystOutput[], rules: Rule[]): Decision {
  const hard = new Set(rules.filter((r) => r.kind === "hard").map((r) => r.id));
  const hardFail = c.checks.filter((ch) => !ch.pass && hard.has(ch.ruleId)).map((ch) => ch.ruleId);
  const votes = outputs.reduce((s, o) => s + (o.stance === "include" ? 1 : o.stance === "exclude" ? -1 : 0) * o.confidence, 0);
  const scoreNudge = Math.max(-5, Math.min(5, Math.round(votes * 2)));
  const include = hardFail.length === 0 && c.status === "included";
  const against = outputs.filter((o) => (include ? o.stance === "exclude" : o.stance === "include")).length;
  const pros = outputs.flatMap((o) => o.points.filter((p) => p.polarity === "pro").map((p) => p.text)).slice(0, 3);
  const cons = outputs.flatMap((o) => o.points.filter((p) => p.polarity === "con").map((p) => p.text)).slice(0, 3);
  const summary = hardFail.length
    ? `Excluded: it breaks your hard rule ${hardFail.join(" and ")}. No score can override that.`
    : include
      ? `Included at **$${c.amount.toLocaleString("en-US")}**. Strongest reason: ${c.pros[0]?.text ?? "it ranks well on your priorities"}.`
      : `Not included: ${c.mainReason}.`;
  return { include, scoreNudge, disagree: against >= 2, summary, pros, cons };
}
