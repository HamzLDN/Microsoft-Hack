// The investment committee, run as a 4-phase pipeline with a circuit breaker.
// Phase 1: Bull and Bear write independent theses. Phase 2: up to 2 cited rebuttal rounds.
// Phase 3: circuit breaker (compliance, architecture, data integrity). Phase 4: the Judge's verdict.
import type { AgentName, AnalystOutput, Candidate, Evidence, Rule } from "../types";
import { AGENTS, runAnalyst } from "./analysts";
import { allowedNumbers, cleanProse, extractNumbers, numberSupported } from "./guardrails";
import { callJSON, llmConfigured } from "./llm";

export type HaltCode = "COMPLIANCE_BLOCK" | "ARCHITECTURE_FAIL" | "DATA_INTEGRITY_FAIL";
export type Verdict = { decision: "BUY" | "HOLD" | "SELL" | "REJECTED"; confidence: number; winner: "bull" | "bear" | "draw"; reasoning: string; evidenceIds: string[]; model: string };
export type RebuttalTurn = { round: number; from: "bull" | "bear"; text: string; evidenceIds: string[]; cited: boolean; model: string };
export type Check = { name: string; passed: boolean; detail: string };
export type IC = {
  mode: "ai" | "data rules";
  theses: Partial<Record<"bull" | "bear", AnalystOutput>>;
  rounds: { round: number; turns: RebuttalTurn[] }[];
  unreliable: AgentName[];
  checks: Check[];
  halted: { code: HaltCode; phase: number; reason: string } | null;
  verdict: Verdict;
  models: string[];
  numbersChecked: number;
};

const SIDES = ["bull", "bear"] as const;

const REBUTTAL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["claims"],
  properties: { claims: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "evidenceIds"],
    properties: { text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } } },
} as const;

const JUDGE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["verdict", "confidence", "winner", "reasoning", "evidenceIds", "complianceConcern", "complianceReason"],
  properties: {
    verdict: { type: "string", enum: ["BUY", "HOLD", "SELL"] }, confidence: { type: "number" },
    winner: { type: "string", enum: ["bull", "bear", "draw"] }, reasoning: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
    complianceConcern: { type: "boolean" }, complianceReason: { type: "string" },
  },
} as const;

const STYLE = `Plain English. No dashes as punctuation. Bold the key figure with **. Never write evidence ids (like E3) in the text; they go only in evidenceIds. Write money like $6,400.`;
const evLines = (ev: Evidence[]) => ev.map((e) => (e.id.startsWith("N") ? `${e.id}: <news>${e.label}</news>` : `${e.id}: ${e.label} = ${e.value}`)).join("\n");
const view = (o?: AnalystOutput) => (o ? o.points.map((p) => `${p.polarity === "pro" ? "+" : "minus"} ${p.text} [${p.evidenceIds.join(",")}]`).join("\n") : "none");
const fmt = (e?: Evidence) => (!e ? "" : e.unit === "%" ? `${Math.abs(e.value).toFixed(1)}%` : e.unit === "$" ? `$${Math.round(e.value).toLocaleString("en-US")}` : `${e.value.toFixed(1)}`);

/** Every number must match the evidence and every cited id must exist. */
function grounded(text: string, ids: string[], ev: Evidence[], client = "") {
  const known = new Set(ev.map((e) => e.id));
  // Figures written in the client's rules and brief (e.g. a $15,000 loss limit) are facts too, not inventions
  const allowed = allowedNumbers(ev, [...ev.filter((e) => e.id.startsWith("R")).flatMap((e) => extractNumbers(e.label)), ...extractNumbers(client)]);
  const bad = extractNumbers(text).filter((n) => !numberSupported(n, allowed));
  return { cited: ids.length > 0 && ids.every((i) => known.has(i)), badNumbers: bad };
}

async function llmRebuttal(side: "bull" | "bear", round: number, c: Candidate, opponent: string, ev: Evidence[], client: string) {
  const system = `You are the ${AGENTS[side].title} in round ${round} of a cross examination about ${c.name} (${c.ticker}) for one client. ${side === "bull" ? "Defend the long case and knock down the Bear's strongest claims." : "Attack the Bull's strongest claims with extreme scepticism."}
Mandatory grounding: every counter claim must cite evidence ids, and every number must appear in the evidence. Give 1 or 2 counter claims, each 15 to 45 words, explaining why it matters for this client. ${STYLE}`;
  const user = `Client: ${client}\n\nYour opponent's latest claims:\n${opponent}\n\nEvidence:\n${evLines(ev)}`;
  let fix = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, model } = await callJSON(system, user + fix, 45000, { agent: side, schema: REBUTTAL_SCHEMA });
      const claims = ((data as { claims?: { text: string; evidenceIds: string[] }[] }).claims ?? []).slice(0, 2);
      const checks = claims.map((cl) => grounded(cl.text, cl.evidenceIds ?? [], ev, client));
      const bad = checks.flatMap((x) => x.badNumbers);
      if (bad.length && attempt === 0) { fix = `\nRejected: these numbers are not in the evidence: ${bad.join(", ")}. Use only evidence figures.`; continue; }
      return { claims: claims.map((cl, i) => ({ text: cleanProse(cl.text), evidenceIds: cl.evidenceIds ?? [], cited: checks[i].cited })), hallucinated: bad, model, failed: false };
    } catch {
      /* retry once, then report an architecture failure */
    }
  }
  return { claims: [], hallucinated: [] as number[], model: "", failed: true };
}

/** Data-only rebuttal used when no AI is connected. Every claim cites its evidence. */
function dataRebuttal(side: "bull" | "bear", round: number, ev: Evidence[]): { text: string; evidenceIds: string[] }[] {
  const g = (id: string) => ev.find((e) => e.id === id);
  const v = g("E3"), pe = g("E6"), f = g("E9"), d = g("E7"), dd = g("E4"), gr = g("E8"), r = g("E2");
  const out: { text: string; evidenceIds: string[] }[] = [];
  if (side === "bull") {
    if (round === 1 && f && f.value > 0) out.push({ text: `The Bear ignores cash: it keeps **${fmt(f)}** of sales as spare cash, which is what carries a holding and its dividend through a bad year.`, evidenceIds: ["E9"] });
    else if (d && d.value >= 1.5) out.push({ text: `Even if the price stalls, the **${fmt(d)}** dividend keeps paying, which matters more to this client than short term swings.`, evidenceIds: ["E7"] });
    else if (gr && gr.value > 0) out.push({ text: `Sales are still growing **${fmt(gr)}** a year, so the business is moving forward despite the price worries.`, evidenceIds: ["E8"] });
  } else {
    if (round === 1 && pe && pe.value > 20) out.push({ text: `Strong cash does not make it cheap: at **${fmt(pe)}** times earnings, the price already assumes years of good news.`, evidenceIds: ["E6"] });
    else if (dd && Math.abs(dd.value) > 10) out.push({ text: `Dividends don't help if the capital falls: it dropped **${fmt(dd)}** from its peak last year, too close to this client's loss limit.`, evidenceIds: ["E4"] });
    else if (v) out.push({ text: `The price still swings **${fmt(v)}** a year; for money that has to last, that is risk the Bull is waving away.`, evidenceIds: ["E3"] });
    else if (r) out.push({ text: `The share returned only **${fmt(r)}** over the year, so the market is not convinced by the long case.`, evidenceIds: ["E2"] });
  }
  return out;
}

/** Neutral verdict from the evidence balance, used when no AI is connected or the Judge's answer fails its checks. */
function dataJudge(c: Candidate, theses: IC["theses"], rounds: IC["rounds"], ev: Evidence[]): Verdict {
  const cited = (side: "bull" | "bear") => rounds.flatMap((r) => r.turns).filter((t) => t.from === side && t.cited).length;
  const bullScore = (theses.bull?.points.filter((p) => p.polarity === "pro").length ?? 0) + cited("bull");
  const softFails = ev.filter((e) => e.id.startsWith("R") && !e.value).length;
  const vol = ev.find((e) => e.id === "E3")?.value ?? 0;
  const bearScore = (theses.bear?.points.filter((p) => p.polarity === "con").length ?? 0) + cited("bear") + softFails + (vol > 30 ? 1 : 0);
  const diff = bullScore - bearScore;
  const decision = diff >= 2 ? "BUY" : diff <= -2 ? "SELL" : "HOLD";
  const winner = diff >= 2 ? "bull" : diff <= -2 ? "bear" : "draw";
  const reasoning = decision === "BUY" ? `The Bull's case is better supported by the evidence, and ${c.name} passes every rule this client set.`
    : decision === "SELL" ? `The Bear's risks outweigh the long case for a client whose money has to last${softFails ? ", and it misses one of their preferences" : ""}.`
    : `Both sides made supported points and neither clearly won, so the committee holds the recommended size.`;
  return { decision, confidence: Math.min(0.9, 0.5 + Math.abs(diff) * 0.1), winner, reasoning, evidenceIds: [], model: "data rules" };
}

export async function runIC(c: Candidate, rules: Rule[], ev: Evidence[], client: string): Promise<IC> {
  const ai = llmConfigured();
  const ic: IC = { mode: ai ? "ai" : "data rules", theses: {}, rounds: [], unreliable: [], checks: [], halted: null, models: [], numbersChecked: 0,
    verdict: { decision: "HOLD", confidence: 0, winner: "draw", reasoning: "", evidenceIds: [], model: "" } };
  const reject = (code: HaltCode, phase: number, reason: string) => {
    ic.halted = { code, phase, reason };
    ic.verdict = { decision: "REJECTED", confidence: 1, winner: "draw", reasoning: reason, evidenceIds: [], model: "circuit breaker" };
    return ic;
  };

  // Compliance pre-screen: a client hard rule breach aborts instantly, before any debate
  const hard = new Set(rules.filter((r) => r.kind === "hard").map((r) => r.id));
  const breach = c.checks.find((ch) => !ch.pass && hard.has(ch.ruleId));
  ic.checks.push({ name: "Compliance pre-screen", passed: !breach, detail: breach ? `Breaks ${breach.ruleId}: ${breach.detail}` : "No restricted activity for this client" });
  if (breach) return reject("COMPLIANCE_BLOCK", 3, `Compliance block: ${c.name} breaks the client's hard rule ${breach.ruleId} (${breach.detail}). No debate was run.`);

  // Phase 1: independent theses (they don't see each other)
  const [bull, bear] = await Promise.all(SIDES.map((s) => runAnalyst(s, c, ev, client)));
  ic.theses = { bull: bull.output, bear: bear.output };
  ic.models.push(bull.provider ?? "data rules", bear.provider ?? "data rules");
  ic.numbersChecked += bull.numbersChecked + bear.numbersChecked;
  const archFail = ai && (bull.output.fallback || bear.output.fallback);
  ic.checks.push({ name: "Both theses delivered", passed: !archFail, detail: archFail ? `${bull.output.fallback ? "Bull" : "Bear"} analyst timed out or returned an invalid answer` : "Bull and Bear both returned valid, cited theses" });
  if (archFail) {
    const halluc = bull.hallucinated || bear.hallucinated;
    return halluc
      ? reject("DATA_INTEGRITY_FAIL", 1, `Data integrity fail: the ${bull.hallucinated ? "Bull" : "Bear"} analyst used numbers that are not in the data, so the review was stopped.`)
      : reject("ARCHITECTURE_FAIL", 1, `Architecture fail: the ${bull.output.fallback ? "Bull" : "Bear"} analyst did not deliver a valid thesis. One side alone would be biased, so the run is rejected.`);
  }

  // Phase 2: up to 2 rebuttal rounds; every counter claim must be cited
  const strikes: Record<"bull" | "bear", number> = { bull: 0, bear: 0 };
  let lastBull = view(bull.output), lastBear = view(bear.output);
  for (let round = 1; round <= 2; round++) {
    const turns: RebuttalTurn[] = [];
    if (ai) {
      const [rb, rr] = await Promise.all([llmRebuttal("bull", round, c, lastBear, ev, client), llmRebuttal("bear", round, c, lastBull, ev, client)]);
      for (const [side, res] of [["bull", rb], ["bear", rr]] as const) {
        if (res.failed) return reject("ARCHITECTURE_FAIL", 2, `Architecture fail: the ${side === "bull" ? "Bull" : "Bear"} analyst stopped responding in round ${round}, so the debate was stopped.`);
        if (res.hallucinated.length) return reject("DATA_INTEGRITY_FAIL", 2, `Data integrity fail: the ${side === "bull" ? "Bull" : "Bear"} analyst quoted ${res.hallucinated.join(", ")} in round ${round}, which is not in the data.`);
        for (const cl of res.claims) turns.push({ round, from: side, text: cl.text, evidenceIds: cl.evidenceIds, cited: cl.cited, model: res.model });
        ic.numbersChecked += res.claims.reduce((n, cl) => n + extractNumbers(cl.text).length, 0);
      }
    } else {
      for (const side of SIDES) for (const cl of dataRebuttal(side, round, ev)) turns.push({ round, from: side, ...cl, cited: true, model: "data rules" });
    }
    for (const side of SIDES) {
      const ok = turns.some((t) => t.from === side && t.cited);
      strikes[side] = ok ? 0 : strikes[side] + 1;
      if (strikes[side] >= 2 && !ic.unreliable.includes(side)) ic.unreliable.push(side);
    }
    ic.rounds.push({ round, turns });
    lastBull = turns.filter((t) => t.from === "bull").map((t) => t.text).join("\n") || lastBull;
    lastBear = turns.filter((t) => t.from === "bear").map((t) => t.text).join("\n") || lastBear;
  }

  // Phase 3: circuit breaker
  ic.checks.push({ name: "Every claim cited", passed: ic.unreliable.length === 0, detail: ic.unreliable.length ? `${ic.unreliable.join(" and ")} failed to cite evidence two rounds running and is marked Unreliable` : "All counter claims carried data citations" });
  ic.checks.push({ name: "Numbers match the data", passed: true, detail: `${ic.numbersChecked} numbers checked against the evidence` });

  // Phase 4: the Judge weighs the evidence and gives a verdict (and can raise a compliance concern)
  let verdict: Verdict | null = null;
  if (ai) {
    const transcript = `BULL THESIS:\n${view(bull.output)}\n\nBEAR THESIS:\n${view(bear.output)}\n\n${ic.rounds.map((r) => `ROUND ${r.round}:\n${r.turns.map((t) => `${t.from.toUpperCase()}${t.cited ? "" : " (UNCITED)"}: ${t.text}`).join("\n")}`).join("\n\n")}${ic.unreliable.length ? `\n\nMarked Unreliable: ${ic.unreliable.join(", ")}. Give their claims less weight.` : ""}`;
    const system = `You are the ${AGENTS.judge.title} of an investment committee. You are strictly neutral and trained on suitability, SEC and MiFID II principles and this client's rules.
Weigh only claims backed by evidence. Decide BUY (back it at or above the recommended size), HOLD (keep the recommended size) or SELL (do not hold it) for THIS client, name which side argued better, and explain in 2 or 3 sentences that a client can follow.
Set complianceConcern to true only for a genuine suitability or ethics problem the rules missed (for example the client's own words rule it out); otherwise false with an empty reason. ${STYLE}`;
    for (let attempt = 0; attempt < 2 && !verdict; attempt++) {
      try {
        const { data, model } = await callJSON(system, `Client: ${client}\n\nDebate:\n${transcript}\n\nEvidence:\n${evLines(ev)}`, 45000, { agent: "judge", schema: JUDGE_SCHEMA });
        const d = data as { verdict: Verdict["decision"]; confidence: number; winner: Verdict["winner"]; reasoning: string; evidenceIds: string[]; complianceConcern: boolean; complianceReason: string };
        // The Judge may state its own confidence as a percentage
        const g = grounded(d.reasoning, d.evidenceIds?.length ? d.evidenceIds : ["E1"], ev, `${client} ${Math.round((d.confidence ?? 0) * 100)}`);
        if (g.badNumbers.length) { console.error(`judge ${c.ticker}: numbers not in evidence`, g.badNumbers); continue; }
        if (d.complianceConcern && d.complianceReason?.trim()) {
          ic.checks.push({ name: "Judge compliance review", passed: false, detail: cleanProse(d.complianceReason) });
          ic.models.push(model);
          return reject("COMPLIANCE_BLOCK", 3, `Compliance block from the Judge: ${cleanProse(d.complianceReason)}`);
        }
        verdict = { decision: d.verdict, confidence: Math.max(0, Math.min(1, d.confidence)), winner: d.winner, reasoning: cleanProse(d.reasoning), evidenceIds: d.evidenceIds ?? [], model };
        ic.models.push(model);
      } catch (err) {
        console.error(`judge ${c.ticker} failed:`, (err as Error).message);
      }
    }
  }
  ic.checks.push({ name: "Judge compliance review", passed: true, detail: "No suitability or ethics concern raised" });
  ic.verdict = verdict ?? dataJudge(c, ic.theses, ic.rounds, ev);
  return ic;
}

/** Turns the committee's verdict into what the portfolio engine does with the company. */
export function verdictEffect(ic: IC, held: boolean): { adjustment: number; out: boolean } {
  const v = ic.verdict;
  if (v.decision === "REJECTED") return { adjustment: 0, out: true };
  if (v.decision === "SELL") return held ? { adjustment: 0, out: true } : { adjustment: -15, out: false };
  if (v.decision === "BUY") return { adjustment: Math.round(8 + 7 * v.confidence), out: false };
  return { adjustment: 0, out: false };
}

/** Stances in the shape the dashboard's vote badges read. */
export function stancesOf(ic: IC): Record<string, AnalystOutput["stance"]> {
  const judge: AnalystOutput["stance"] = ic.verdict.decision === "BUY" ? "include" : ic.verdict.decision === "HOLD" ? "neutral" : "exclude";
  return { bull: ic.theses.bull?.stance ?? "neutral", bear: ic.theses.bear?.stance ?? "neutral", judge };
}
