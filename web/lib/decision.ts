// The final decision is made in code. Analysts can nudge the score by at most 5 points and flag disagreement.
import type { AnalystOutput, Candidate, Rule } from "./types";

export type Decision = { include: boolean; scoreNudge: number; disagree: boolean; summary: string; pros: string[]; cons: string[] };

const VOTE_ORDER = ["fundamentals", "markets", "fit"] as const;
const VOTE_NAME: Record<(typeof VOTE_ORDER)[number], string> = { fundamentals: "Fundamentals", markets: "Markets", fit: "Client fit" };

export type VoteTally = { include: number; neutral: number; exclude: number; majority: "include" | "exclude" | "neutral" | "split"; summary: string };

/** Count the three final votes. Disagreement is kept. It is not talked into a unanimous result. */
export function voteOf(stances: Record<string, string>): VoteTally {
  const bucket = (s: string) => VOTE_ORDER.filter((a) => stances[a] === s);
  const include = bucket("include");
  const neutral = bucket("neutral");
  const exclude = bucket("exclude");
  const top = Math.max(include.length, neutral.length, exclude.length);
  const leaders = ([["include", include.length], ["neutral", neutral.length], ["exclude", exclude.length]] as const).filter(([, n]) => n === top).map(([k]) => k);
  const majority = leaders.length === 1 ? leaders[0] : "split";
  const who = (list: readonly string[]) => list.map((a) => VOTE_NAME[a as (typeof VOTE_ORDER)[number]]).join(" and ");
  let summary: string;
  if (include.length === 3) summary = "All three voted include. That is a real vote, not a requirement that they agree.";
  else if (exclude.length === 3) summary = "All three voted exclude, so the committee does not back a full position.";
  else if (majority === "split") summary = "No majority. Each vote stands, and the split only nudges the dollar amount.";
  else if (exclude.length >= 2) summary = `${who(exclude)} voted exclude, so the amount is cut. ${include.length ? `${who(include)} still votes include, and that dissent stays.` : "The other vote stays on the record."}`;
  else if (exclude.length === 1) summary = `${who(exclude)} voted exclude and was not talked out of it. ${include.length ? `${who(include)} voted include.` : ""} The chat is the argument. This tally is the decision.`;
  else summary = `${include.length} include, ${neutral.length} neutral, ${exclude.length} exclude. Majority: ${majority}. A neutral vote is not pushed into include.`;
  return { include: include.length, neutral: neutral.length, exclude: exclude.length, majority, summary };
}

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
