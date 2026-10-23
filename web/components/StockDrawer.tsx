"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { METRIC_TERMS } from "@/lib/ai/glossary";
import { decide } from "@/lib/decision";
import type { AgentName, AnalystOutput, AppRule, Candidate, Evidence, Portfolio } from "@/lib/types";
import { api, Bold, Info, money, Pill } from "./ui";

const AGENTS: { key: AgentName; title: string; tag: string; color: string }[] = [
  { key: "fundamentals", title: "Fundamentals analyst", tag: "filings and financials", color: "#2F7FC1" },
  { key: "markets", title: "Markets and news analyst", tag: "prices, news, economy", color: "#7A86C8" },
  { key: "fit", title: "Client fit analyst", tag: "your rules", color: "#3E8E7E" },
];
const RANGES = ["1W", "1M", "6M", "1Y", "5Y"];
type Run = { output: AnalystOutput; evidence: Evidence[]; attempts: number; provider?: string };
type Turn = { from: AgentName; to: AgentName | "committee"; kind: "agree" | "challenge" | "question" | "summary"; text: string; evidenceIds: string[]; model: string };
type Debate = { turns: Turn[]; finalStances: Record<AgentName, AnalystOutput["stance"]>; shifts: { agent: AgentName; from: string; to: string; reason: string }[]; fallback: boolean };
type CommitteeItem = { round1: AnalystOutput[]; models: string[]; debate: Debate; adjustment: number; evidence: Evidence[]; before: { status: string; amount: number; score: number }; after?: { status: string; amount: number; score: number } };
type Msg = { role: "user" | "assistant"; content: string };

function Chart({ points }: { points: [string, number][] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    let chart: any;
    import("lightweight-charts").then(({ createChart, ColorType }) => {
      if (!ref.current) return;
      const up = points[points.length - 1][1] >= points[0][1];
      chart = createChart(ref.current, {
        height: 200, layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#5E6E7E", fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { color: "#EEF3F8" } }, rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false }, handleScroll: false, handleScale: false, crosshair: { horzLine: { visible: false } },
      });
      const s = chart.addAreaSeries({ lineColor: up ? "#2E7D5B" : "#B4473A", topColor: up ? "rgba(46,125,91,.22)" : "rgba(180,71,58,.2)", bottomColor: "rgba(255,255,255,0)", lineWidth: 2 });
      s.setData(points.map(([t, v]) => ({ time: t, value: v })));
      chart.timeScale().fitContent();
    });
    return () => chart?.remove();
  }, [points]);
  return <div ref={ref} className="w-full" />;
}

function AnalystCard({ a, run, onAsk }: { a: (typeof AGENTS)[number]; run?: Run; onAsk: (agent: AgentName, msgs: Msg[]) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!q.trim() || !run) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setQ(""); setBusy(true);
    const reply = await onAsk(a.key, next).catch(() => "I couldn't answer that just now.");
    setMsgs([...next, { role: "assistant", content: reply }]); setBusy(false);
  };
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[40px_1fr] gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl font-serif text-lg font-semibold text-white" style={{ background: a.color }}>{a.title[0]}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{a.title} <span className="font-normal text-muted">· {a.tag}</span>
          {run && <span className="ml-2">{run.output.stance === "include" ? <Pill tone="good">Leans include</Pill> : run.output.stance === "exclude" ? <Pill tone="bad">Leans exclude</Pill> : <Pill tone="warn">Neutral</Pill>}</span>}
        </p>
        <button type="button" onClick={() => run && setOpen(!open)} className="mt-1 block w-full rounded-xl border border-line bg-card p-3 text-left text-sm transition hover:border-accent">
          {!run ? <span className="block animate-pulse text-muted">Reviewing the evidence…</span> : (
            <>
              <ul className="grid gap-1.5">
                {run.output.points.map((p, i) => (
                  <li key={i} className="flex gap-2"><span className={p.polarity === "pro" ? "text-good" : "text-bad"}>{p.polarity === "pro" ? "+" : "−"}</span>
                    <span><Bold text={p.text} /> {p.evidenceIds.map((id) => { const e = run.evidence.find((x) => x.id === id); return <span key={id} title={e ? `${e.label}: ${e.value} (${e.source}, ${e.asOf})` : id} className="num ml-1 rounded bg-sky px-1 text-[10px] text-accent">{id}</span>; })}</span></li>
                ))}
              </ul>
              {run.output.fallback && <p className="mt-2 text-xs text-muted">Summary generated directly from the data.</p>}
              <p className="mt-2 text-xs font-semibold text-accent">{open ? "Hide conversation" : "Ask this analyst a follow up"}</p>
            </>
          )}
        </button>
        <AnimatePresence>
          {open && run && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 grid gap-2 rounded-xl bg-sky p-3 text-sm">
                {msgs.map((m, i) => <p key={i} className={`whitespace-pre-line rounded-lg p-2 ${m.role === "user" ? "ml-8 bg-card" : "mr-8 bg-baby"}`}><Bold text={m.content} /></p>)}
                {busy && <p className="animate-pulse text-muted">Thinking…</p>}
                <div className="flex gap-2">
                  <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Why do you say that?" className="flex-1 rounded-lg border border-line bg-card p-2" />
                  <button className="btn px-3 py-2" onClick={send}>Ask</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function StockDrawer({ ticker, p, rules, client, shown, onClose, onAsk, onReweight, committeeItem }: {
  ticker: string | null; p: Portfolio | null; rules: AppRule[]; client: string; shown: string[]; onClose: () => void; onAsk: (q: string) => void; onReweight: (w: Record<string, number>) => void;
  committeeItem?: CommitteeItem;
}) {
  const c: Candidate | undefined = p && ticker ? [...p.holdings, ...p.considered].find((x) => x.ticker === ticker) : undefined;
  const [range, setRange] = useState("1Y");
  const [points, setPoints] = useState<[string, number][]>([]);
  const [quote, setQuote] = useState<{ price: number; changePct: number; live: boolean } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { value: number; source: string; asOf: string }>>({});
  const [runs, setRuns] = useState<Partial<Record<AgentName, Run>>>({});
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [debate, setDebate] = useState<Debate | null>(null);

  useEffect(() => { if (ticker) api(`/api/data/history/${ticker}?range=${range}`).then((r) => setPoints(r.points)).catch(() => setPoints([])); }, [ticker, range]);
  useEffect(() => {
    if (!ticker) return;
    setRuns({}); setMetrics({}); setQuote(null); setWeights(null); setRange("1Y"); setDebate(null);
    api(`/api/data/metrics/${ticker}`).then((r) => setMetrics(r.metrics)).catch(() => null);
    const q = () => api(`/api/data/quote/${ticker}`).then(setQuote).catch(() => null);
    q();
    const t = setInterval(q, 15000);
    return () => clearInterval(t);
  }, [ticker]);
  useEffect(() => {
    if (!c || !p) return;
    if (committeeItem) {
      setRuns(Object.fromEntries(committeeItem.round1.map((o, i) => [o.agent, { output: o, evidence: committeeItem.evidence, attempts: 1, provider: committeeItem.models[i] }])));
      setDebate(committeeItem.debate);
      return;
    }
    for (const a of AGENTS) {
      api("/api/analysis", { agent: a.key, candidate: c, rules, badYearLoss: p.badYearLoss, client })
        .then((r) => setRuns((x) => ({ ...x, [a.key]: { output: r.output, evidence: r.evidence, attempts: r.attempts, provider: r.provider } })))
        .catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.ticker]);

  const done = AGENTS.map((a) => runs[a.key]).filter(Boolean) as Run[];
  useEffect(() => {
    if (!c || done.length !== 3 || debate) return;
    api<Debate>("/api/debate", { candidate: c, round1: done.map((r) => r.output), evidence: done[0].evidence, client }).then(setDebate).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.length, c?.ticker]);
  const finalOutputs = done.map((r) => (debate ? { ...r.output, stance: debate.finalStances[r.output.agent] ?? r.output.stance } : r.output));
  const decision = c && done.length === 3 && debate ? decide(c, finalOutputs, rules) : null;
  const askAnalyst = async (agent: AgentName, messages: Msg[]) => {
    const r = runs[agent];
    const view = r ? r.output.points.map((p) => `${p.polarity === "pro" ? "+" : "minus"} ${p.text}`).join("; ") : "";
    return (await api("/api/chat", { mode: "analyst", agent, ticker: c?.ticker, evidence: r?.evidence ?? [], client, view, messages })).reply as string;
  };
  const fmt = (k: string, v: number) => (k === "price" ? `$${v.toFixed(2)}` : k === "mcap" ? `$${v.toFixed(0)}B` : ["pe", "beta", "debtToEquity"].includes(k) ? v.toFixed(2) : `${v.toFixed(1)}%`);
  const parts = c?.score.parts ?? [];
  const w = weights ?? Object.fromEntries(parts.map((x) => [x.name, x.weight]));

  return (
    <AnimatePresence>
      {ticker && c && (
        <>
          <motion.div className="fixed inset-0 z-30 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed bottom-0 right-0 top-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-line bg-paper p-6 shadow-paper" aria-label={`${c.name} analysis`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="num text-sm text-muted">{c.ticker} · {c.sector}</p><h2 className="font-serif text-3xl font-semibold">{c.name}</h2>
                <div className="mt-1">{c.status === "included" ? <Pill tone="good">Included · {money(c.amount)}</Pill> : <Pill tone="bad">Excluded</Pill>}</div></div>
              <button className="btn-ghost px-3 py-1.5" onClick={onClose}>Close</button>
            </div>

            <section className="paper mt-5 p-4">
              <div className="flex items-baseline gap-3">
                <b className="num text-3xl font-medium">{quote ? `$${quote.price.toFixed(2)}` : ""}</b>
                {quote && <span className={quote.changePct >= 0 ? "text-good" : "text-bad"}>{quote.changePct >= 0 ? "+" : "minus "}{Math.abs(quote.changePct).toFixed(2)}% today</span>}
                {quote && <span className="ml-auto flex items-center gap-1 text-xs text-muted"><i className={`h-2 w-2 rounded-full ${quote.live ? "animate-pulse bg-good" : "bg-muted"}`} />{quote.live ? "live" : "delayed"}</span>}
              </div>
              <Chart points={points} />
              <div className="flex gap-1">{RANGES.map((r) => <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 text-xs font-semibold ${range === r ? "bg-ink text-white" : "text-muted hover:bg-sky"}`}>{r}</button>)}</div>
            </section>

            <section className="mt-5"><p className="label mb-2">Key figures</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shown.filter((k) => metrics[k]).map((k) => (
                  <div key={k} className="paper p-3"><span className="text-xs text-muted">{METRIC_TERMS[k]}<Info term={METRIC_TERMS[k]} onAsk={onAsk} /></span>
                    <b className="num block text-lg font-medium">{fmt(k, metrics[k].value)}</b><span className="text-[10px] text-muted">{metrics[k].source}, {metrics[k].asOf}</span></div>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-goodsoft p-4"><p className="label !text-good">Pros</p><ul className="mt-2 grid gap-1.5 text-sm">{c.pros.map((x, i) => <li key={i}>+ <Bold text={x.text} /></li>)}</ul></div>
              <div className="rounded-xl bg-badsoft p-4"><p className="label !text-bad">Cons</p><ul className="mt-2 grid gap-1.5 text-sm">{c.cons.map((x, i) => <li key={i}>minus <Bold text={x.text} /></li>)}</ul></div>
            </section>

            <section className="paper mt-5 p-4"><p className="label mb-2">Your rules</p>
              <ul className="grid gap-1.5 text-sm">{c.checks.map((ch) => { const r = rules.find((x) => x.id === ch.ruleId); return (
                <li key={ch.ruleId} className="grid grid-cols-[18px_36px_1fr] items-start gap-2"><span className={ch.pass ? "text-good" : "text-bad"}>{ch.pass ? "✓" : "✕"}</span><span className="num rounded bg-baby px-1 text-center text-accent">{ch.ruleId}</span>
                  <span>{r?.text} <span className="text-muted">· {ch.detail} · {r?.kind === "hard" ? "hard rule" : "preference"}</span></span></li>); })}</ul>
            </section>

            {parts.length > 0 && (
              <section className="paper mt-5 p-4">
                <div className="flex items-baseline justify-between"><p className="label">Where the score of {Math.round(c.score.total)} comes from<Info term="Score" onAsk={onAsk} /></p>
                  <button className="text-xs font-semibold text-accent" onClick={() => setWeights(weights ? null : w)}>{weights ? "Cancel" : "Change how we score"}</button></div>
                <ul className="mt-2 grid gap-2 text-sm">
                  {parts.map((x) => (
                    <li key={x.name} className="grid grid-cols-[110px_1fr_70px] items-center gap-2">
                      <span>{x.name}<Info term={x.name} onAsk={onAsk} /></span>
                      {weights ? <input aria-label={`${x.name} weight`} type="range" min={0} max={50} value={w[x.name]} onChange={(e) => setWeights({ ...w, [x.name]: +e.target.value })} className="accent-accent" />
                        : <span className="h-2 overflow-hidden rounded-full bg-sky"><i className="block h-full bg-accent" style={{ width: `${x.value}%` }} /></span>}
                      <span className="num text-right text-xs text-muted">{weights ? `weight ${w[x.name]}` : `${Math.round(x.value)} × ${Math.round(x.weight)}%`}</span>
                    </li>
                  ))}
                  {c.score.ruleAdjustments.filter((a) => a.points).map((a) => <li key={a.ruleId} className="text-xs text-muted">{a.ruleId}: {a.points > 0 ? "plus" : "minus"} {Math.abs(a.points)} points</li>)}
                </ul>
                {weights && <button className="btn mt-3" onClick={() => { onReweight(weights); setWeights(null); }}>Rebuild with these weights</button>}
              </section>
            )}

            <section className="mt-6"><p className="label mb-3">AI analysis · round 1 · each specialist&apos;s view</p>
              <div className="grid gap-4">{AGENTS.map((a) => <AnalystCard key={a.key} a={a} run={runs[a.key]} onAsk={askAnalyst} />)}</div>
            </section>

            {done.length === 3 && (
              <section className="mt-6">
                <p className="label mb-3">Round 2 · committee discussion</p>
                {!debate ? <p className="animate-pulse text-sm text-muted">The analysts are reading each other&apos;s views…</p> : (
                  <div className="grid gap-3 rounded-xl border border-line bg-card p-4">
                    {debate.turns.map((t, i) => {
                      const from = AGENTS.find((a) => a.key === t.from)!;
                      const to = t.to === "committee" ? "the committee" : AGENTS.find((a) => a.key === t.to)!.title;
                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.35 }} className="grid grid-cols-[32px_1fr] gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg font-serif font-semibold text-white" style={{ background: from.color }}>{from.title[0]}</div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted"><b className="text-ink">{from.title}</b> to {to} · {t.kind === "challenge" ? <span className="text-bad">challenges</span> : t.kind === "agree" ? <span className="text-good">agrees</span> : t.kind === "question" ? <span className="text-warn">asks</span> : "sums up"} <span className="num ml-1 rounded bg-sky px-1.5 text-[10px] text-accent">{t.model}</span></p>
                            <p className="mt-1 rounded-xl rounded-tl-sm bg-sky p-3 text-sm"><Bold text={t.text} /> {t.evidenceIds.map((id) => <span key={id} className="num ml-1 rounded bg-card px-1 text-[10px] text-accent">{id}</span>)}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                    {debate.shifts?.length > 0 && (
                      <div className="rounded-lg border border-warn/40 bg-warnsoft p-3 text-sm">
                        <p className="label !text-warn">Minds changed</p>
                        {debate.shifts.map((x) => <p key={x.agent} className="mt-1"><b>{AGENTS.find((a) => a.key === x.agent)!.title}</b>: {x.from} to <b>{x.to}</b>{x.reason ? `, because ${x.reason.charAt(0).toLowerCase()}${x.reason.slice(1)}` : ""}.</p>)}
                      </div>
                    )}
                    {committeeItem?.after && (
                      <div className="rounded-lg bg-baby p-3 text-sm">
                        <p className="label !text-accent">Effect on the portfolio</p>
                        <p className="mt-1">Committee score change <b className="num">{committeeItem.adjustment > 0 ? "plus" : committeeItem.adjustment < 0 ? "minus" : ""} {Math.abs(committeeItem.adjustment)}</b> · score <span className="num">{Math.round(committeeItem.before.score)} to {Math.round(committeeItem.after.score)}</span> · amount <span className="num">{money(committeeItem.before.amount)} to {money(committeeItem.after.amount)}</span>{committeeItem.before.status !== committeeItem.after.status ? ` · now ${committeeItem.after.status}` : ""}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted">After the discussion: {AGENTS.map((a) => `${a.title.split(" ")[0]} leans ${debate.finalStances[a.key]}`).join(" · ")}.{debate.fallback ? " Discussion generated from the data while the AI key is not connected." : ""}</p>
                  </div>
                )}
              </section>
            )}

            {decision && (
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-xl border-2 border-accent bg-sky p-4">
                <p className="label !text-accent">Decision</p>
                <p className="mt-1"><Bold text={decision.summary} /></p>
                {decision.disagree && <p className="mt-2"><Pill tone="warn">Analysts disagree</Pill> <span className="text-sm text-muted">Two analysts lean the other way. Read both views above.</span></p>}
                <p className="mt-2 text-xs text-muted">The decision follows your rules and the score. Analysts can move the score by at most 5 points ({decision.scoreNudge >= 0 ? "plus" : "minus"} {Math.abs(decision.scoreNudge)} here) and can never override a hard rule.</p>
              </motion.section>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
