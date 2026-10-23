import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/ai/analysts";
import { GLOSSARY, lookup } from "@/lib/ai/glossary";
import { allowedNumbers, extractNumbers, numberSupported, stripDashes } from "@/lib/ai/guardrails";
import { callText, llmConfigured } from "@/lib/ai/llm";
import type { AgentName, Evidence } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const STYLE = "Plain English for someone who is not an expert. Under 120 words. Bold the key term or figure with **double asterisks**. No dashes as punctuation.";

function closestEvidence(q: string, ev: Evidence[]) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return ev.map((e) => ({ e, s: words.filter((w) => e.label.toLowerCase().includes(w)).length })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.e);
}

export async function POST(req: Request) {
  const { mode, agent, evidence = [], context = "", client = "", view = "", messages } = (await req.json()) as {
    mode: "analyst" | "help"; agent?: AgentName; evidence?: Evidence[]; context?: string; client?: string; view?: string; messages: Msg[];
  };
  const q = messages[messages.length - 1]?.content ?? "";

  if (mode === "help") {
    const local = lookup(q);
    if (!llmConfigured()) {
      return NextResponse.json({ reply: local ? `**${Object.keys(GLOSSARY).find((k) => GLOSSARY[k] === local)}**: ${local}` : "I can explain any metric or term on screen. Try asking about volatility, bad year loss, or the score." });
    }
    try {
      const sys = `You are the help assistant in Mandate, an investing app for individuals. Explain terms and what is on screen. Use this glossary as the source of truth:\n${Object.entries(GLOSSARY).map(([k, v]) => `${k}: ${v}`).join("\n")}\nWhat the user is looking at: ${context}\nNever give personal financial advice. ${STYLE}`;
      const r = await callText([{ role: "system", content: sys }, ...messages.slice(-6)]);
      return NextResponse.json({ reply: stripDashes(r.text) });
    } catch {
      return NextResponse.json({ reply: local ?? "I couldn't reach the AI just now. Tap the info icon next to any metric for its meaning." });
    }
  }

  const role = AGENTS[agent ?? "fundamentals"];
  const ev = evidence.filter(role.ids);
  if (!llmConfigured()) return NextResponse.json({ reply: explainFromData(q, ev, role.title), offline: true });
  const sys = `You are the ${role.title} on this client's investment committee. You focus on ${role.focus}.
Talk to the client like a thoughtful analyst in a meeting: answer the question directly first, then explain why it matters for their goals and what the trade off is. Give your honest view, including doubts.
The client: ${client || context}
Your earlier view of this company: ${view || "not given"}
Evidence you may use (cite ids in square brackets when you use a number):
${ev.map((e) => `${e.id}: ${e.label} = ${e.value} (${e.source}, ${e.asOf})`).join("\n")}
Every number you write must come from that evidence; you may describe things qualitatively without numbers. If the evidence can't answer something, say what you would need to know. Never give personal financial advice beyond this educational analysis. ${STYLE}`;
  const allowed = allowedNumbers(ev);
  let msgs = [{ role: "system" as const, content: sys }, ...messages.slice(-8)];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await callText(msgs, 45000, { agent });
      const bad = extractNumbers(r.text).filter((n) => !numberSupported(n, allowed));
      if (!bad.length) return NextResponse.json({ reply: stripDashes(r.text), model: r.model });
      msgs = [...msgs, { role: "assistant" as const, content: r.text }, { role: "user" as const, content: `Some figures (${bad.join(", ")}) are not in the evidence. Answer again using only evidence figures, or describe them in words.` }];
    } catch {
      break;
    }
  }
  return NextResponse.json({ reply: explainFromData(q, ev, role.title), offline: true });
}

/** Offline answer: picks the evidence that matches the question and explains it in plain English. */
function explainFromData(q: string, ev: Evidence[], title: string) {
  const hits = closestEvidence(q, ev);
  const pick = hits.length ? hits : ev.filter((e) => /^E/.test(e.id)).slice(0, 2);
  if (!pick.length) return "I don't have data on that for this company.";
  const parts = pick.map((e) => {
    const v = e.unit === "%" ? `${Math.abs(e.value).toFixed(1)}%` : e.unit === "$" ? `$${Math.round(e.value).toLocaleString("en-US")}` : `${e.value}`;
    const meaning = lookup(e.label);
    return `**${e.label}** is **${v}** (${e.source}, ${e.asOf}).${meaning ? ` ${meaning}` : ""}`;
  });
  return `${parts.join("\n\n")}\n\nThat's the figure from our data. Connect the AI key for a full answer from the ${title.toLowerCase()}.`;
}
