"use client";
// One view of an investment committee run, shared by the stock drawer and Backstage.
import { useState } from "react";
import type { IC } from "@/lib/ai/ic";
import type { Evidence } from "@/lib/types";
import { Bold, money, Pill } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };
export type Ask = (agent: "bull" | "bear" | "judge", msgs: Msg[]) => Promise<string>;

export const IC_AGENTS = {
  bull: { title: "Bull analyst", tag: "growth and momentum", color: "#2E7D5B", letter: "B" },
  bear: { title: "Bear analyst", tag: "value and risk", color: "#B4473A", letter: "R" },
  judge: { title: "Judge", tag: "Chief Compliance Officer", color: "#2F7FC1", letter: "J" },
} as const;

const HALT_TEXT: Record<string, string> = {
  COMPLIANCE_BLOCK: "Compliance block",
  ARCHITECTURE_FAIL: "Architecture fail",
  DATA_INTEGRITY_FAIL: "Data integrity fail",
};

function Avatar({ a, size = 9 }: { a: keyof typeof IC_AGENTS; size?: number }) {
  const s = size === 9 ? "h-9 w-9" : "h-7 w-7";
  return <span className={`grid ${s} shrink-0 place-items-center rounded-lg font-serif font-semibold text-white`} style={{ background: IC_AGENTS[a].color }}>{IC_AGENTS[a].letter}</span>;
}

function Chips({ ids, evidence }: { ids: string[]; evidence?: Evidence[] }) {
  return <>{ids.map((id) => { const e = evidence?.find((x) => x.id === id); return <span key={id} title={e ? `${e.label}: ${e.value} (${e.source}, ${e.asOf})` : id} className="num ml-1 rounded bg-sky px-1 text-[10px] text-accent">{id}</span>; })}</>;
}

function ChatBox({ agent, onAsk }: { agent: keyof typeof IC_AGENTS; onAsk: Ask }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!q.trim()) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setQ(""); setBusy(true);
    const reply = await onAsk(agent, next).catch(() => "I couldn't answer that just now.");
    setMsgs([...next, { role: "assistant", content: reply }]); setBusy(false);
  };
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-sky p-3 text-sm">
      {msgs.map((m, i) => <p key={i} className={`whitespace-pre-line rounded-lg p-2 ${m.role === "user" ? "ml-8 bg-card" : "mr-8 bg-baby"}`}><Bold text={m.content} /></p>)}
      {busy && <p className="animate-pulse text-muted">Thinking…</p>}
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Ask the ${IC_AGENTS[agent].title.toLowerCase()}…`} className="flex-1 rounded-lg border border-line bg-card p-2" />
        <button className="btn px-3 py-2" onClick={send}>Ask</button>
      </div>
    </div>
  );
}

function Thesis({ side, ic, evidence, onAsk }: { side: "bull" | "bear"; ic: IC; evidence?: Evidence[]; onAsk?: Ask }) {
  const [open, setOpen] = useState(false);
  const t = ic.theses[side];
  if (!t) return null;
  const a = IC_AGENTS[side];
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-2"><Avatar a={side} size={7} /><b className="text-sm">{a.title}</b><span className="text-xs text-muted">{side === "bull" ? "Long thesis" : "Short thesis"}</span>
        {ic.unreliable.includes(side) && <Pill tone="warn">Unreliable</Pill>}</div>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {t.points.map((p, i) => <li key={i} className="flex gap-2"><span className={p.polarity === "pro" ? "text-good" : "text-bad"}>{p.polarity === "pro" ? "+" : "−"}</span><span><Bold text={p.text} /><Chips ids={p.evidenceIds} evidence={evidence} /></span></li>)}
      </ul>
      {t.fallback && <p className="mt-1 text-xs text-muted">Written from the data rules.</p>}
      {onAsk && <button className="mt-2 text-xs font-semibold text-accent" onClick={() => setOpen(!open)}>{open ? "Hide" : `Question the ${side}`}</button>}
      {open && onAsk && <ChatBox agent={side} onAsk={onAsk} />}
    </div>
  );
}

const PHASES = ["Independent research", "Rebuttal rounds", "Circuit breaker", "Judge's verdict"];

export function CommitteeView({ ic, evidence, onAsk, effect }: {
  ic: IC; evidence?: Evidence[]; onAsk?: Ask;
  effect?: { before: { status: string; amount: number }; after?: { status: string; amount: number } };
}) {
  const [askJudge, setAskJudge] = useState(false);
  const reached = ic.halted ? ic.halted.phase : 4;
  const v = ic.verdict;
  const tone = v.decision === "BUY" ? "good" : v.decision === "HOLD" ? "warn" : "bad";
  return (
    <div className="grid gap-4">
      <ol className="grid grid-cols-4 gap-1 text-[11px]">
        {PHASES.map((ph, i) => {
          const n = i + 1;
          const tripped = ic.halted && ic.halted.phase === n;
          const skipped = ic.halted && n > ic.halted.phase;
          return <li key={ph} className={`rounded-lg px-2 py-1.5 text-center ${tripped ? "bg-badsoft font-semibold text-bad" : skipped ? "bg-paper text-muted line-through" : n <= reached ? "bg-baby text-accent" : "bg-paper text-muted"}`}>Phase {n}<br />{ph}</li>;
        })}
      </ol>

      {ic.halted && (
        <div className="rounded-xl border-2 border-bad bg-badsoft p-4">
          <p className="label !text-bad">Circuit breaker tripped · {HALT_TEXT[ic.halted.code]} · <span className="num">{ic.halted.code}</span></p>
          <p className="mt-1 text-sm"><Bold text={ic.halted.reason} /></p>
          <p className="mt-1 text-xs text-muted">The run was stopped and the recommendation automatically rejected: a No Go for this client.</p>
        </div>
      )}

      {(ic.theses.bull || ic.theses.bear) && (
        <section>
          <p className="label mb-2">Phase 1 · independent theses (they don&apos;t see each other)</p>
          <div className="grid gap-3 sm:grid-cols-2"><Thesis side="bull" ic={ic} evidence={evidence} onAsk={onAsk} /><Thesis side="bear" ic={ic} evidence={evidence} onAsk={onAsk} /></div>
        </section>
      )}

      {ic.rounds.length > 0 && (
        <section>
          <p className="label mb-2">Phase 2 · cross examination (every claim must cite data)</p>
          <div className="grid gap-3 rounded-xl border border-line bg-card p-4">
            {ic.rounds.map((r) => (
              <div key={r.round} className="grid gap-2">
                <p className="text-xs font-semibold text-muted">Round {r.round}</p>
                {r.turns.map((t, i) => (
                  <div key={i} className={`flex gap-2 ${t.from === "bear" ? "flex-row-reverse text-right" : ""}`}>
                    <Avatar a={t.from} size={7} />
                    <div className="min-w-0 max-w-[85%]">
                      <p className="text-[11px] text-muted"><b className="text-ink">{IC_AGENTS[t.from].title}</b> · {t.model}{!t.cited && <span className="ml-1 text-bad">· no citation</span>}</p>
                      <p className={`mt-0.5 inline-block rounded-xl p-2.5 text-left text-sm ${t.from === "bull" ? "rounded-tl-sm bg-goodsoft" : "rounded-tr-sm bg-badsoft"}`}><Bold text={t.text} /><Chips ids={t.evidenceIds} evidence={evidence} /></p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="label mb-2">Phase 3 · circuit breaker checks</p>
        <ul className="grid gap-1 text-sm">
          {ic.checks.map((c, i) => <li key={i} className="flex gap-2"><span className={c.passed ? "text-good" : "text-bad"}>{c.passed ? "✓" : "✕"}</span><span><b>{c.name}</b> <span className="text-muted">· {c.detail}</span></span></li>)}
        </ul>
      </section>

      <section className="rounded-xl border-2 border-accent bg-sky p-4">
        <div className="flex flex-wrap items-center gap-2"><Avatar a="judge" size={7} /><p className="label !text-accent">Phase 4 · Judge&apos;s verdict</p>
          <Pill tone={tone}>{v.decision === "REJECTED" ? "REJECTED · No Go" : v.decision}</Pill>
          {v.decision !== "REJECTED" && <span className="text-xs text-muted">{Math.round(v.confidence * 100)}% confidence · {v.winner === "draw" ? "no clear winner" : `${v.winner === "bull" ? "Bull" : "Bear"} argued better`} · {v.model}</span>}</div>
        <p className="mt-2 text-sm"><Bold text={v.reasoning} /><Chips ids={v.evidenceIds} evidence={evidence} /></p>
        {effect?.after && (
          <p className="mt-2 text-sm"><b>Effect on the portfolio:</b> <span className="num">{money(effect.before.amount)} to {money(effect.after.amount)}</span>{effect.before.status !== effect.after.status ? ` · now ${effect.after.status}` : ""}</p>
        )}
        {onAsk && v.decision !== "REJECTED" && <button className="mt-2 text-xs font-semibold text-accent" onClick={() => setAskJudge(!askJudge)}>{askJudge ? "Hide" : "Question the Judge"}</button>}
        {askJudge && onAsk && <ChatBox agent="judge" onAsk={onAsk} />}
        {ic.mode === "data rules" && <p className="mt-2 text-xs text-muted">Run on data rules because the AI was not connected.</p>}
      </section>
    </div>
  );
}
