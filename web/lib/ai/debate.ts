// Round 2: the three analysts read each other's views, reply, and may change their stance. Same evidence, same checks.
import type { AgentName, AnalystOutput, Candidate, Evidence } from "../types";
import { AGENTS } from "./analysts";
import { allowedNumbers, extractNumbers, numberSupported, stripDashes } from "./guardrails";
import { callJSON, llmConfigured } from "./llm";

type Stance = AnalystOutput["stance"];
export type Turn = { from: AgentName; to: AgentName | "committee"; kind: "agree" | "challenge" | "question" | "summary"; text: string; evidenceIds: string[]; model: string };
export type Shift = { agent: AgentName; from: Stance; to: Stance; reason: string };
export type Debate = { turns: Turn[]; finalStances: Record<AgentName, Stance>; shifts: Shift[]; fallback: boolean };

export const ORDER: AgentName[] = ["fundamentals", "markets", "fit"];
const VAL: Record<Stance, number> = { include: 1, neutral: 0, exclude: -1 };
const down = (s: Stance): Stance => (s === "include" ? "neutral" : "exclude");
const up = (s: Stance): Stance => (s === "exclude" ? "neutral" : "include");

const DEBATE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["replies", "finalStance", "stanceChangeReason"],
  properties: {
    finalStance: { type: "string", enum: ["include", "exclude", "neutral"] },
    stanceChangeReason: { type: "string" },
    replies: { type: "array", items: { type: "object", additionalProperties: false, required: ["to", "kind", "text", "evidenceIds"],
      properties: { to: { type: "string", enum: ["fundamentals", "markets", "fit"] }, kind: { type: "string", enum: ["agree", "challenge", "question"] },
        text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } },
  },
} as const;

const view = (o: AnalystOutput) => `${AGENTS[o.agent].title} (leans ${o.stance}):\n${o.points.map((p) => `  ${p.polarity === "pro" ? "+" : "minus"} ${p.text} [${p.evidenceIds.join(",")}]`).join("\n")}`;

function checkReply(r: { text: string; evidenceIds: string[] }, ev: Evidence[]) {
  const ids = new Set(ev.map((e) => e.id));
  const allowed = allowedNumbers(ev);
  return r.evidenceIds.every((id) => ids.has(id)) && extractNumbers(r.text).every((n) => numberSupported(n, allowed)) && r.text.split(/\s+/).length >= 10;
}

async function llmTurns(agent: AgentName, c: Candidate, round1: AnalystOutput[], ev: Evidence[], client: string) {
  const others = round1.filter((o) => o.agent !== agent);
  const mine = round1.find((o) => o.agent === agent)!;
  const system = `You are the ${AGENTS[agent].title} on an investment committee for one individual client, discussing ${c.name} (${c.ticker}). You focus on ${AGENTS[agent].focus}.
Read your colleagues' views and reply to them directly, the way analysts argue in a meeting. Challenge where your specialty sees a risk they missed, agree where the evidence supports them, or ask a pointed question. Every reply must explain WHY, in terms of this client's goals, not just repeat a figure.
Then decide your final stance. Change it if a colleague made a point that matters for this client, and say which point in stanceChangeReason (empty string if unchanged). Changing your mind when the evidence warrants it is expected.
Rules: 1 or 2 replies, each 15 to 50 words, each to a named colleague. Use only numbers from the evidence and cite their ids. Bold the key figure with **. No dashes as punctuation.`;
  const user = `Client: ${client}\n\nYour first view:\n${view(mine)}\n\nColleagues:\n${others.map(view).join("\n\n")}\n\nEvidence:\n${ev.map((e) => `${e.id}: ${e.label} = ${e.value}`).join("\n")}`;
  let fix = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, model } = await callJSON(system, user + fix, 45000, { agent, schema: DEBATE_SCHEMA });
      const d = data as { replies: { to: AgentName; kind: Turn["kind"]; text: string; evidenceIds: string[] }[]; finalStance: Stance; stanceChangeReason: string };
      const replies = (d.replies || []).filter((r) => r.to !== agent && ORDER.includes(r.to)).slice(0, 2);
      if (replies.length && replies.every((r) => checkReply(r, ev))) {
        return { turns: replies.map((r) => ({ from: agent, to: r.to, kind: r.kind, text: stripDashes(r.text), evidenceIds: r.evidenceIds, model })), stance: d.finalStance, reason: stripDashes(d.stanceChangeReason || "") };
      }
      fix = `\nYour last reply was rejected: replies must explain the point for this client in at least 15 words and use only figures listed above.`;
    } catch {
      /* try again, then fall back */
    }
  }
  return null;
}

const fmt = (e?: Evidence) => (!e ? "" : e.unit === "%" ? `${Math.abs(e.value).toFixed(1)}%` : e.unit === "$" ? `$${Math.round(e.value).toLocaleString("en-US")}` : `${e.value.toFixed(1)}`);

/** Rule-based discussion used when no LLM is connected. Challenges that land move the other analyst's stance. */
export function fallbackDebate(c: Candidate, round1: AnalystOutput[], ev: Evidence[]): Debate {
  const g = (id: string) => ev.find((e) => e.id === id);
  const turns: Turn[] = [];
  const final = Object.fromEntries(round1.map((o) => [o.agent, o.stance])) as Record<AgentName, Stance>;
  const reasons: Partial<Record<AgentName, string>> = {};
  const vol = g("E3"), pe = g("E6"), ret = g("E2"), fcf = g("E9"), div = g("E7"), dd = g("E4"), growth = g("E8");
  const say = (from: AgentName, to: Turn["to"], kind: Turn["kind"], text: string, ids: string[]) =>
    turns.push({ from, to, kind, text, evidenceIds: ids.filter((i) => ev.some((e) => e.id === i)), model: "data rules" });

  if (vol && vol.value > 28) {
    say("markets", "fundamentals", "challenge", `The business may be sound, but the share swings **${fmt(vol)}** a year. For a client with a bad year loss limit, that ride matters as much as the profits, so I would hold less of it.`, ["E3"]);
    final.fundamentals = down(final.fundamentals); reasons.fundamentals = "Markets showed the price swings are too large for this client's loss limit";
  } else if (vol) {
    say("markets", "fundamentals", "agree", `I agree with you. The share has also been calm, at **${fmt(vol)}** volatility, so the quality you describe has not come with a bumpy ride for this client.`, ["E3"]);
    if (final.fundamentals === "neutral") { final.fundamentals = "include"; reasons.fundamentals = "Markets confirmed the price has been calm"; }
  }
  if (pe && ret && pe.value > 30 && ret.value > 10) {
    say("fundamentals", "markets", "challenge", `You like the **${fmt(ret)}** rise, but at **${fmt(pe)}** times earnings much of the good news is already paid for. Someone retiring in a few years has less time to wait out a correction.`, ["E6", "E2"]);
    final.markets = down(final.markets); reasons.markets = "Fundamentals showed the price already assumes a lot";
  } else if (fcf && fcf.value > 10) {
    say("fundamentals", "markets", "agree", `Whatever the price does next month, it turns **${fmt(fcf)}** of sales into spare cash. That is what keeps dividends coming through a bad year, which is what this client needs.`, ["E9"]);
    if (final.markets === "neutral") { final.markets = "include"; reasons.markets = "Fundamentals showed strong cash generation"; }
  } else if (dd) {
    say("fundamentals", "markets", "question", `It fell **${fmt(dd)}** from its peak last year. Was that the market or the business? Without strong cash flow to lean on, I would not want this client relying on a quick recovery.`, ["E4"]);
  }
  const failing = ev.filter((e) => e.id.startsWith("R") && !e.value);
  if (failing.length) {
    say("fit", "committee", "challenge", `Before we go further, it fails ${failing[0].label.split(":")[0]}. However good the company is, this client told us what matters to them, so I can't back a full position.`, [failing[0].id]);
    final.fit = down(final.fit); reasons.fit = `It fails ${failing[0].label.split(" ")[0]}`;
  } else if (div && div.value >= 2) {
    say("fit", "committee", "agree", `It passes every rule this client set, and the **${fmt(div)}** dividend fits their plan to draw income after retiring. I'm comfortable backing it at the recommended size.`, ["E7"]);
    final.fit = up(final.fit); if (final.fit !== round1.find((o) => o.agent === "fit")?.stance) reasons.fit = "Its dividend fits the client's income goal";
  } else if (growth && growth.value < 0) {
    say("fit", "committee", "challenge", `Sales fell **${fmt(growth)}** last year. This client needs the money to last, and a shrinking business is the wrong place for it, even if it passes the rules.`, ["E8"]);
    final.fit = down(final.fit); reasons.fit = "A shrinking business does not suit a client who needs the money to last";
  } else {
    say("fit", "committee", "agree", `It passes every rule this client set. My only note is to keep it at the recommended size, so no single company can dent their retirement plan.`, ["A1"]);
  }
  const shifts = round1.filter((o) => final[o.agent] !== o.stance).map((o) => ({ agent: o.agent, from: o.stance, to: final[o.agent], reason: reasons[o.agent] ?? "" }));
  return { turns, finalStances: final, shifts, fallback: true };
}

export async function runDebate(c: Candidate, round1: AnalystOutput[], ev: Evidence[], client: string): Promise<Debate> {
  if (!llmConfigured() || round1.length < 3) return fallbackDebate(c, round1, ev);
  const results = await Promise.all(ORDER.map((a) => llmTurns(a, c, round1, ev, client)));
  const fb = results.some((r) => !r) ? fallbackDebate(c, round1, ev) : null;
  const finalStances = Object.fromEntries(ORDER.map((a, i) => [a, results[i]?.stance ?? fb!.finalStances[a]])) as Debate["finalStances"];
  const turns = ORDER.flatMap((a, i) => results[i]?.turns ?? fb!.turns.filter((t) => t.from === a));
  const shifts = round1.filter((o) => finalStances[o.agent] !== o.stance).map((o) => {
    const i = ORDER.indexOf(o.agent);
    return { agent: o.agent, from: o.stance, to: finalStances[o.agent], reason: results[i]?.reason || fb?.shifts.find((s) => s.agent === o.agent)?.reason || "" };
  });
  return { turns, finalStances, shifts, fallback: !!fb };
}

/** Turns the committee's final positions into a score change the engine applies. Discussion moves count extra. */
export function committeeAdjustment(round1: AnalystOutput[], d: Debate): number {
  const votes = round1.reduce((s, o) => s + VAL[d.finalStances[o.agent]] * Math.max(0.3, o.confidence), 0);
  const moved = d.shifts.reduce((s, x) => s + (VAL[x.to] - VAL[x.from]), 0);
  let adj = Math.round(votes * 4 + moved * 4);
  if (Object.values(d.finalStances).filter((s) => s === "exclude").length >= 2) adj = Math.min(adj, -15);
  return Math.max(-15, Math.min(15, adj));
}
