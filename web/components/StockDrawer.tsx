"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { METRIC_TERMS } from "@/lib/ai/glossary";
import type { IC } from "@/lib/ai/ic";
import type { AppRule, Candidate, Evidence, Portfolio } from "@/lib/types";
import { CommitteeView, type Ask } from "./CommitteeView";
import { api, Bold, Info, money, Pill } from "./ui";

const RANGES = ["1W", "1M", "6M", "1Y", "5Y"];
type CommitteeItem = { ic: IC; evidence?: Evidence[]; before: { status: string; amount: number; score: number }; after?: { status: string; amount: number; score: number } };

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

export function StockDrawer({ ticker, p, rules, client, shown, onClose, onAsk, onReweight, committeeItem }: {
  ticker: string | null; p: Portfolio | null; rules: AppRule[]; client: string; shown: string[]; onClose: () => void; onAsk: (q: string) => void; onReweight: (w: Record<string, number>) => void;
  committeeItem?: CommitteeItem;
}) {
  const c: Candidate | undefined = p && ticker ? [...p.holdings, ...p.considered].find((x) => x.ticker === ticker) : undefined;
  const [range, setRange] = useState("1Y");
  const [points, setPoints] = useState<[string, number][]>([]);
  const [quote, setQuote] = useState<{ price: number; changePct: number; live: boolean } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { value: number; source: string; asOf: string }>>({});
  const [run, setRun] = useState<{ ic: IC; evidence: Evidence[] } | null>(null);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => { if (ticker) api(`/api/data/history/${ticker}?range=${range}`).then((r) => setPoints(r.points)).catch(() => setPoints([])); }, [ticker, range]);
  useEffect(() => {
    if (!ticker) return;
    setRun(null); setMetrics({}); setQuote(null); setRange("1Y"); setShowAI(false);
    api(`/api/data/metrics/${ticker}`).then((r) => setMetrics(r.metrics)).catch(() => null);
    const q = () => api(`/api/data/quote/${ticker}`).then(setQuote).catch(() => null);
    q();
    const t = setInterval(q, 15000);
    return () => clearInterval(t);
  }, [ticker]);
  useEffect(() => {
    // The committee only runs when the user opens it; a company the review already covered loads instantly
    if (!c || !p || !showAI || run) return;
    if (committeeItem?.ic) { setRun({ ic: committeeItem.ic, evidence: committeeItem.evidence ?? [] }); return; }
    api("/api/ic", { candidate: c, rules, badYearLoss: p.badYearLoss, client }).then((r) => setRun({ ic: r.ic, evidence: r.evidence })).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.ticker, showAI]);

  const askAgent: Ask = async (agent, messages) => {
    const t = agent === "judge" ? null : run?.ic.theses[agent];
    const view = agent === "judge" ? `Verdict ${run?.ic.verdict.decision}: ${run?.ic.verdict.reasoning}` : t ? t.points.map((x) => `${x.polarity === "pro" ? "+" : "minus"} ${x.text}`).join("; ") : "";
    return (await api("/api/chat", { mode: "analyst", agent, ticker: c?.ticker, evidence: run?.evidence ?? [], client, view, messages })).reply as string;
  };
  const fmt = (k: string, v: number) => (k === "price" ? `$${v.toFixed(2)}` : k === "mcap" ? `$${v.toFixed(0)}B` : ["pe", "beta", "debtToEquity"].includes(k) ? v.toFixed(2) : `${v.toFixed(1)}%`);

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

            {!showAI ? (
              <section className="mt-6 rounded-xl border border-line bg-card p-4">
                <p className="font-semibold">Investment committee</p>
                <p className="mt-1 text-sm text-muted">A Bull and a Bear analyst argue the case for and against {c.name} using only cited data, a circuit breaker stops the run on any compliance or data problem, and a neutral Judge gives the verdict.</p>
                <button className="btn mt-3" onClick={() => setShowAI(true)}>Show committee review</button>
              </section>
            ) : (
              <section className="mt-6">
                <div className="mb-3 flex items-baseline justify-between"><p className="label">Investment committee</p><button className="text-sm font-semibold text-accent" onClick={() => setShowAI(false)}>Hide</button></div>
                {!run ? <p className="animate-pulse text-sm text-muted">Bull and Bear are researching, then they cross examine each other. This takes about a minute…</p>
                  : <CommitteeView ic={run.ic} evidence={run.evidence} onAsk={askAgent} effect={committeeItem?.after ? { before: committeeItem.before, after: committeeItem.after } : undefined} />}
              </section>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
