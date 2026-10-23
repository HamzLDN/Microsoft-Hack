import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/ai/analysts";
import { GLOSSARY, lookup } from "@/lib/ai/glossary";
import { allowedNumbers, cleanProse, extractNumbers, numberSupported, stripDashes } from "@/lib/ai/guardrails";
import { callText, llmConfigured } from "@/lib/ai/llm";
import { answerHelpChat } from "@/lib/mcp/helpChat";
import { resolveUser } from "@/lib/server/auth";
import { db, save } from "@/lib/server/db";
import type { AgentName, Evidence } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

function log(req: Request, entry: { mode: string; agent?: string; ticker?: string; question: string; reply: string; model?: string; offline?: boolean; retried?: boolean; blocked?: number[] }) {
  const d = db();
  d.chats = [{ at: new Date().toISOString(), userId: resolveUser(req)?.id ?? "anon", ...entry }, ...(d.chats ?? [])].slice(0, 300);
  save();
}
const reply = (req: Request, body: Record<string, unknown>, entry: Parameters<typeof log>[1]) => { log(req, entry); return NextResponse.json(body); };

const STYLE = "Plain English for someone who is not an expert. Under 120 words. Bold the key term or figure with **double asterisks**. No dashes as punctuation.";

function closestEvidence(q: string, ev: Evidence[]) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return ev.map((e) => ({ e, s: words.filter((w) => e.label.toLowerCase().includes(w)).length })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.e);
}

export async function POST(req: Request) {
  const { mode, agent, ticker, evidence = [], context = "", client = "", view = "", messages } = (await req.json()) as {
    mode: "analyst" | "help"; agent?: AgentName; ticker?: string; evidence?: Evidence[]; context?: string; client?: string; view?: string; messages: Msg[];
  };
  const q = messages[messages.length - 1]?.content ?? "";

  if (mode === "help") {
    const term = lookup(q);
    const glossaryAnswer = term ? `**${Object.keys(GLOSSARY).find((k) => GLOSSARY[k] === term)}**: ${term}` : "";
    // 1. Live data and tools (prices, metrics) through the MCP server
    try {
      const text = stripDashes(await answerHelpChat(q, context, messages));
      return reply(req, { reply: text }, { mode, question: q, reply: text, offline: !llmConfigured() });
    } catch (err) {
      console.error("help chat tools failed, answering without them:", (err as Error).message);
    }
    // 2. Plain AI answer grounded in the glossary, no tools needed
    if (llmConfigured()) {
      try {
        const sys = `You are the help assistant in Mandate, an investing app for individuals. Explain terms and what is on screen in plain English. Use this glossary as the source of truth:\n${Object.entries(GLOSSARY).map(([k, v]) => `${k}: ${v}`).join("\n")}\nWhat the user is looking at: ${context}\nLive prices are unavailable right now, so do not quote any. Use US dollars in examples. Never give personal financial advice. ${STYLE}`;
        const r = await callText([{ role: "system", content: sys }, ...messages.slice(-6)], 30000);
        const text = cleanProse(r.text);
        return reply(req, { reply: text, model: r.model }, { mode, question: q, reply: text, model: r.model });
      } catch {
        /* fall through to the glossary */
      }
    }
    // 3. Glossary only
    const text = glossaryAnswer || "I can explain anything on screen, like **volatility**, **bad year loss** or the **score**. Live prices are unavailable right now.";
    return reply(req, { reply: text }, { mode, question: q, reply: text, offline: true });
  }

  const role = AGENTS[agent ?? "fundamentals"];
  const ev = evidence.filter(role.ids);
  if (!llmConfigured()) { const text = explainFromData(q, ev, role.title); return reply(req, { reply: text, offline: true }, { mode, agent, ticker, question: q, reply: text, offline: true }); }
  const sys = `You are the ${role.title} on this client's investment committee. You focus on ${role.focus}.
Talk to the client like a thoughtful analyst in a meeting: answer the question directly first, then explain why it matters for their goals and what the trade off is. Give your honest view, including doubts.
The client: ${client || context}
Your earlier view of this company: ${view || "not given"}
Evidence you may use:
${ev.map((e) => `${e.id}: ${e.label} = ${e.value} (${e.source}, ${e.asOf})`).join("\n")}
Every number you write must come from that evidence; you may describe things qualitatively without numbers. Do not write evidence ids like E7 in your answer. If the evidence can't answer something, say what you would need to know. Never give personal financial advice beyond this educational analysis. ${STYLE}`;
  const allowed = allowedNumbers(ev);
  let msgs = [{ role: "system" as const, content: sys }, ...messages.slice(-8)];
  let blocked: number[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await callText(msgs, 45000, { agent });
      const bad = extractNumbers(r.text).filter((n) => !numberSupported(n, allowed));
      if (!bad.length) {
        const text = cleanProse(r.text);
        return reply(req, { reply: text, model: r.model }, { mode, agent, ticker, question: q, reply: text, model: r.model, retried: attempt > 0, blocked });
      }
      blocked = [...blocked, ...bad];
      msgs = [...msgs, { role: "assistant" as const, content: r.text }, { role: "user" as const, content: `Some figures (${bad.join(", ")}) are not in the evidence. Answer again using only evidence figures, or describe them in words.` }];
    } catch {
      break;
    }
  }
  const text = explainFromData(q, ev, role.title);
  return reply(req, { reply: text, offline: true }, { mode, agent, ticker, question: q, reply: text, offline: true, blocked });
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
