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
const line = (e: Evidence) => `**${e.label}**: ${e.value}${e.unit === "%" ? "%" : ""} (${e.source}, ${e.asOf}) [${e.id}]`;

export async function POST(req: Request) {
  const { mode, agent, evidence = [], context = "", messages } = (await req.json()) as {
    mode: "analyst" | "help"; agent?: AgentName; evidence?: Evidence[]; context?: string; messages: Msg[];
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
  if (!llmConfigured()) {
    const hits = closestEvidence(q, ev);
    return NextResponse.json({ reply: hits.length ? `From the data I have:\n${hits.map(line).join("\n")}` : `I can only answer from the evidence for this company. The figures I have are:\n${ev.slice(0, 4).map(line).join("\n")}` });
  }
  try {
    const sys = `You are the ${role.title}. You focus on ${role.focus}. Answer the client's follow up using only this evidence, citing ids in square brackets:\n${ev.map((e) => `${e.id}: ${e.label} = ${e.value} (${e.source}, ${e.asOf})`).join("\n")}\nIf the evidence cannot answer it, say so. Every number must come from the evidence. ${STYLE}`;
    const r = await callText([{ role: "system", content: sys }, ...messages.slice(-8)], 30000, { agent });
    const allowed = allowedNumbers(ev);
    const bad = extractNumbers(r.text).filter((n) => !numberSupported(n, allowed));
    if (bad.length) {
      const hits = closestEvidence(q, ev);
      return NextResponse.json({ reply: `I can't confirm that from our data. The closest figures I have are:\n${(hits.length ? hits : ev.slice(0, 3)).map(line).join("\n")}`, blocked: bad });
    }
    return NextResponse.json({ reply: stripDashes(r.text) });
  } catch {
    return NextResponse.json({ reply: `I couldn't reach the AI just now. The figures I have are:\n${ev.slice(0, 4).map(line).join("\n")}` });
  }
}
