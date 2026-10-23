// Round 2: the three analysts read each other's views and reply. Same evidence, same checks.
import type { AgentName, AnalystOutput, Candidate, Evidence } from "../types";
import { AGENTS } from "./analysts";
import { claudeConfigured } from "./claude";
import { allowedNumbers, extractNumbers, numberSupported, stripDashes } from "./guardrails";
import { callJSON, llmConfigured } from "./llm";

export type Turn = { from: AgentName; to: AgentName | "committee"; kind: "agree" | "challenge" | "question" | "summary"; text: string; evidenceIds: string[]; model: string };
export type Debate = { turns: Turn[]; finalStances: Record<AgentName, AnalystOutput["stance"]>; fallback: boolean };

const ORDER: AgentName[] = ["fundamentals", "markets", "fit"];

const DEBATE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["replies", "finalStance"],
  properties: {
    finalStance: { type: "string", enum: ["include", "exclude", "neutral"] },
    replies: { type: "array", items: { type: "object", additionalProperties: false, required: ["to", "kind", "text", "evidenceIds"],
      properties: { to: { type: "string", enum: ["fundamentals", "markets", "fit"] }, kind: { type: "string", enum: ["agree", "challenge", "question"] },
        text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } } } },
  },
} as const;

const view = (o: AnalystOutput) => `${AGENTS[o.agent].title} (leans ${o.stance}):\n${o.points.map((p) => `  ${p.polarity === "pro" ? "+" : "minus"} ${p.text} [${p.evidenceIds.join(",")}]`).join("\n")}`;

function checkReply(r: { text: string; evidenceIds: string[] }, ev: Evidence[]) {
  const ids = new Set(ev.map((e) => e.id));
  const allowed = allowedNumbers(ev);
  return r.evidenceIds.every((id) => ids.has(id)) && extractNumbers(r.text).every((n) => numberSupported(n, allowed));
}

async function llmTurns(agent: AgentName, c: Candidate, round1: AnalystOutput[], ev: Evidence[], client: string): Promise<{ turns: Turn[]; stance: AnalystOutput["stance"]; model: string } | null> {
  const others = round1.filter((o) => o.agent !== agent);
  const mine = round1.find((o) => o.agent === agent)!;
  const system = `You are the ${AGENTS[agent].title} on an investment committee for one individual client, discussing ${c.name} (${c.ticker}). You focus on ${AGENTS[agent].focus}.
Read your colleagues' views and reply to them directly, the way analysts talk in a meeting: agree where the evidence supports them, challenge where your specialty sees a risk they missed, or ask a pointed question. Address the client's goals.
Rules: 1 or 2 replies, each under 45 words, each to a named colleague. Use only numbers from the evidence and cite their ids. Bold the key figure with **. No dashes as punctuation. Then give your final stance after hearing them.`;
  const user = `Client: ${client}\n\nYour first view:\n${view(mine)}\n\nColleagues:\n${others.map(view).join("\n\n")}\n\nEvidence:\n${ev.map((e) => `${e.id}: ${e.label} = ${e.value}`).join("\n")}`;
  let fix = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, model } = await callJSON(system, user + fix, 45000, { agent, schema: DEBATE_SCHEMA });
      const d = data as { replies: { to: AgentName; kind: Turn["kind"]; text: string; evidenceIds: string[] }[]; finalStance: AnalystOutput["stance"] };
      const replies = (d.replies || []).filter((r) => r.to !== agent && ORDER.includes(r.to)).slice(0, 2);
      const bad = replies.filter((r) => !checkReply(r, ev));
      if (replies.length && !bad.length) {
        return { turns: replies.map((r) => ({ from: agent, to: r.to, kind: r.kind, text: stripDashes(r.text), evidenceIds: r.evidenceIds, model })), stance: d.finalStance, model };
      }
      fix = `\nYour last reply used numbers or ids not in the evidence. Only use figures listed above.`;
    } catch {
      /* try again, then fall back */
    }
  }
  return null;
}

const fmt = (e?: Evidence) => (!e ? "" : e.unit === "%" ? `${Math.abs(e.value).toFixed(1)}%` : e.unit === "$" ? `$${Math.round(e.value).toLocaleString("en-US")}` : `${e.value.toFixed(1)}`);

/** Rule-based discussion used when no LLM is connected. Every sentence comes from the evidence. */
export function fallbackDebate(c: Candidate, round1: AnalystOutput[], ev: Evidence[]): Debate {
  const g = (id: string) => ev.find((e) => e.id === id);
  const turns: Turn[] = [];
  const vol = g("E3"), pe = g("E6"), ret = g("E2"), fcf = g("E9"), div = g("E7"), dd = g("E4");
  const say = (from: AgentName, to: Turn["to"], kind: Turn["kind"], text: string, ids: string[]) =>
    turns.push({ from, to, kind, text, evidenceIds: ids.filter((i) => ev.some((e) => e.id === i)), model: "data rules" });
  if (vol && vol.value > 25) say("markets", "fundamentals", "challenge", `The business may be sound, but the share swings **${fmt(vol)}** a year. For a client with a loss limit, that ride matters as much as the profits.`, ["E3"]);
  else if (vol) say("markets", "fundamentals", "agree", `I agree. The share has also been calm, at **${fmt(vol)}** volatility, so the quality you describe hasn't come with a bumpy ride.`, ["E3"]);
  if (pe && ret && pe.value > 30 && ret.value > 10) say("fundamentals", "markets", "challenge", `The price has gone up **${fmt(ret)}**, but at **${fmt(pe)}** times earnings a lot of good news is already paid for.`, ["E6", "E2"]);
  else if (fcf && fcf.value > 0) say("fundamentals", "markets", "agree", `Whatever the price does short term, it turns **${fmt(fcf)}** of sales into spare cash. That is what carries a holding through a bad year.`, ["E9"]);
  else if (dd) say("fundamentals", "markets", "question", `It fell **${fmt(dd)}** from its peak last year. Was that the market or something in the business? The filings don't show cash flow strength to lean on.`, ["E4"]);
  const failing = ev.filter((e) => e.id.startsWith("R") && !e.value);
  if (failing.length) say("fit", "committee", "challenge", `Before we go further: it fails ${failing[0].label.split(":")[0]}. Whatever the merits, the client's own rules come first.`, [failing[0].id]);
  else if (div && div.value >= 2) say("fit", "committee", "agree", `It passes every rule the client set, and the **${fmt(div)}** dividend fits their wish for income later. I'm comfortable at the recommended size.`, ["E7"]);
  else say("fit", "committee", "agree", `It passes every rule the client set. My only note is to keep it at the recommended size so no single company dominates.`, ["A1"]);
  const finalStances = Object.fromEntries(round1.map((o) => [o.agent, o.stance])) as Debate["finalStances"];
  if (failing.length) finalStances.fit = "exclude";
  return { turns, finalStances, fallback: true };
}

export async function runDebate(c: Candidate, round1: AnalystOutput[], ev: Evidence[], client: string): Promise<Debate> {
  if (!llmConfigured() || round1.length < 3) return fallbackDebate(c, round1, ev);
  const results = await Promise.all(ORDER.map((a) => llmTurns(a, c, round1, ev, client)));
  if (results.some((r) => !r)) {
    const fb = fallbackDebate(c, round1, ev);
    return { ...fb, turns: ORDER.flatMap((a, i) => results[i]?.turns ?? fb.turns.filter((t) => t.from === a)) };
  }
  const finalStances = Object.fromEntries(ORDER.map((a, i) => [a, results[i]!.stance])) as Debate["finalStances"];
  return { turns: results.flatMap((r) => r!.turns), finalStances, fallback: false };
}

export const debateUsesClaude = () => claudeConfigured();
