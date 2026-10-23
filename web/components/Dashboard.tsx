"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppRule, Candidate, Portfolio } from "@/lib/types";
import { ChallengeScreen, CommitteeCard, ConsideredScreen, Funnel } from "./Results";
import { api, Bold, Info, money, Pill, Screen } from "./ui";

const COLORS = ["#2F7FC1", "#5AA2DB", "#86BCE6", "#3E8E7E", "#6FB3A3", "#7A86C8", "#A39BD8", "#C48BA6", "#D2A26B", "#8FA65A", "#5E9FB8", "#B7C9D8"];
const RANGES = ["6M", "1Y", "5Y"] as const;
type Range = (typeof RANGES)[number];
type Trust = { correctionRate: number | null; correctionsStored: number; learned: { notes: string[] } | null; stats: { analystRuns: number; firstTryPass: number; retried: number; fallbacks: number; numbersChecked: number; unsupportedBlocked: number }; evals: unknown };
type Committee = { status: "idle" | "running" | "done" | "failed"; changes?: { ticker: string; name: string; kind: string; before: number; after: number; scoreBefore: number; scoreAfter: number; reason: string; speaker: string }[]; items?: { ticker: string; debate: { finalStances: Record<string, string>; shifts: unknown[] }; ic?: { verdict: { decision: string } } }[]; sessionId?: string; reviewed?: number };

function slicePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function AllocationPie({ slices, active, onPick }: { slices: { key: string; label: string; value: number; color: string }[]; active: string | null; onPick: (k: string) => void }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { ...s, start, end: angle, pct: (s.value / total) * 100 };
  });
  const focus = arcs.find((a) => a.key === active) ?? arcs[0];
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
      <svg viewBox="0 0 200 200" className="mx-auto h-52 w-52" role="img" aria-label="Portfolio allocation by holding">
        {arcs.length === 1 ? (
          <circle cx="100" cy="100" r="78" fill={arcs[0].color} />
        ) : arcs.map((a) => (
          <path key={a.key} d={slicePath(100, 100, a.key === active ? 86 : 78, a.start, a.end - 0.012)} fill={a.color} opacity={active && active !== a.key ? 0.35 : 1}
            className="cursor-pointer transition" onClick={() => onPick(a.key)} />
        ))}
        <circle cx="100" cy="100" r="46" fill="#FFFFFF" />
        {focus && (
          <>
            <text x="100" y="94" textAnchor="middle" fill="#1B2733" fontSize="18" fontFamily="Georgia, serif">{focus.pct.toFixed(0)}%</text>
            <text x="100" y="112" textAnchor="middle" fill="#5E6E7E" fontSize="11">{focus.key}</text>
          </>
        )}
      </svg>
      <ul className="grid max-h-52 gap-1 overflow-auto pr-1 text-sm">
        {arcs.map((a) => (
          <li key={a.key}>
            <button type="button" onClick={() => onPick(a.key)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left ${active === a.key ? "bg-sky" : "hover:bg-sky"}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
              <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
              <span className="num text-muted">{a.pct.toFixed(1)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClassDonut({ split }: { split: Portfolio["split"] }) {
  const parts = [
    { label: "Shares", value: split.stocks, color: "#2F7FC1" },
    { label: "Bonds", value: split.bonds, color: "#86BCE6" },
    { label: "Cash", value: split.cash, color: "#D2A26B" },
  ].filter((p) => p.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 34;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" role="img" aria-label="Shares, bonds and cash">
        {parts.map((p) => {
          const len = (p.value / total) * circ;
          const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />;
          offset += len;
          return el;
        })}
      </svg>
      <ul className="grid gap-1 text-sm">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span>{p.label}</span><b className="num">{p.value}%</b></li>)}
      </ul>
    </div>
  );
}

function HBars({ rows }: { rows: { label: string; value: number; display: string; color: string }[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-xs"><span className="truncate font-medium">{r.label}</span><span className="num shrink-0 text-muted">{r.display}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sky"><div className="h-full rounded-full" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: r.color }} /></div>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ points }: { points: { time: string; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    let dead = false;
    let chart: { remove: () => void; timeScale: () => { fitContent: () => void } } | undefined;
    const up = points[points.length - 1].value >= points[0].value;
    import("lightweight-charts").then(({ createChart, ColorType }) => {
      if (dead || !ref.current) return;
      const c = createChart(ref.current, {
        height: 220, layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#5E6E7E", fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { color: "#EEF3F8" } }, rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false }, handleScroll: false, handleScale: false,
      });
      const s = c.addAreaSeries({ lineColor: up ? "#2E7D5B" : "#B4473A", topColor: up ? "rgba(46,125,91,.2)" : "rgba(180,71,58,.18)", bottomColor: "rgba(255,255,255,0)", lineWidth: 2 });
      s.setData(points);
      c.timeScale().fitContent();
      chart = c;
    });
    return () => { dead = true; chart?.remove(); };
  }, [points]);
  return <div ref={ref} className="w-full" />;
}

function blend(series: { weight: number; points: [string, number][] }[]) {
  const maps = series.filter((s) => s.points.length > 2).map((s) => ({ weight: s.weight, map: new Map(s.points) }));
  if (!maps.length) return [];
  const dates = [...maps[0].map.keys()].filter((d) => maps.every((m) => m.map.has(d)));
  if (dates.length < 2) return [];
  const start = dates[0];
  const weight = maps.reduce((s, m) => s + m.weight, 0) || 1;
  return dates.map((d) => {
    const indexed = maps.reduce((s, m) => s + (m.weight / weight) * ((m.map.get(d) ?? 0) / (m.map.get(start) || 1)), 0);
    return { time: d, value: Math.round(indexed * 1000) / 10 };
  });
}

export type BoardView = "overview" | "considered" | "challenge";

export function Dashboard({ p, rules, onOpen, onEdit, onAsk, trust, committee, onRerunCommittee, onResetLearning, onDecide, learnedNote, view, onView }: {
  p: Portfolio; rules: AppRule[]; onOpen: (t: string) => void; onEdit: () => void; onAsk: (q: string) => void;
  trust: Trust | null; committee: Committee; onRerunCommittee: () => void; onResetLearning: () => void;
  onDecide: (c: Candidate, own: boolean) => void; learnedNote: string; view: BoardView; onView: (v: BoardView) => void;
}) {
  const [active, setActive] = useState<string | null>(p.holdings[0]?.ticker ?? null);
  const [range, setRange] = useState<Range>("1Y");
  const [trend, setTrend] = useState<{ time: string; value: number }[] | null>(null);
  const [covered, setCovered] = useState(0);
  const [returns, setReturns] = useState<{ name: string; ret: number }[] | null>(null);
  const loss = rules.find((r) => r.field === "max_bad_year_loss");
  const slices = p.holdings.map((h, i) => ({ key: h.ticker, label: h.name, value: h.amount, color: COLORS[i % COLORS.length] }));
  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of p.holdings) map.set(h.sector || "Other", (map.get(h.sector || "Other") ?? 0) + h.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, display: money(value), color: COLORS[i % COLORS.length] }));
  }, [p.holdings]);

  const dissent = (t: string) => {
    const it = committee.items?.find((x) => x.ticker === t);
    const v = it?.ic?.verdict;
    if (!v) return null;
    return v.decision === "BUY" ? <Pill tone="good">Judge: BUY</Pill> : v.decision === "HOLD" ? <Pill tone="blue">Judge: HOLD</Pill> : <Pill tone="bad">{v.decision === "REJECTED" ? "Rejected" : "Judge: SELL"}</Pill>;
  };

  useEffect(() => {
    let cancel = false;
    const holdings = p.holdings;
    setTrend(null);
    setReturns(null);
    const load = async () => {
      const rows: { h: (typeof holdings)[number]; points: [string, number][]; ret?: number }[] = [];
      for (let i = 0; i < holdings.length; i += 4) {
        const batch = holdings.slice(i, i + 4);
        const part = await Promise.all(batch.map(async (h) => {
          const hist = await api<{ points?: [string, number][] }>(`/api/data/history/${encodeURIComponent(h.ticker)}?range=${range}`).catch(() => null);
          const met = await api<{ metrics?: { ret1y?: { value?: number } } }>(`/api/data/metrics/${encodeURIComponent(h.ticker)}`).catch(() => null);
          return { h, points: hist?.points ?? [], ret: met?.metrics?.ret1y?.value };
        }));
        rows.push(...part);
      }
      return rows;
    };
    load().then((rows) => {
      if (cancel) return;
      const usable = rows.filter((r) => r.points.length > 2);
      setCovered(usable.length);
      setTrend(blend(usable.map((r) => ({ weight: r.h.amount, points: r.points }))));
      const rets = rows.filter((r) => typeof r.ret === "number").map((r) => ({ name: r.h.name, ret: r.ret as number }));
      setReturns(rets.sort((a, b) => b.ret - a.ret));
    });
    return () => { cancel = true; };
  }, [p.holdings, range]);

  const move = trend && trend.length > 1 ? trend[trend.length - 1].value - 100 : null;

  if (view === "considered") {
    return <ConsideredScreen embedded p={p} rules={rules} onOpen={onOpen} onBack={() => onView("overview")} onChallenge={() => onView("challenge")} />;
  }
  if (view === "challenge") {
    return <ChallengeScreen embedded p={p} onDecide={onDecide} onOpen={onOpen} onDone={() => onView("overview")} learnedNote={learnedNote} />;
  }

  return (
    <Screen k="dashboard">
      <div id="overview">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Dashboard</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">Your portfolio</h1>
            <p className="mt-1 max-w-xl text-muted">{money(p.holdings.reduce((s, h) => s + h.amount, 0))} built from the budget you entered. Allocation, performance and the reason for every holding, on this screen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => onView("considered")}>Everything considered</button>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => onView("challenge")}>Challenge it</button>
            <button className="btn px-3 py-2 text-sm" onClick={onEdit}>Edit details</button>
          </div>
        </div>
        <Funnel p={p} />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="paper p-4"><p className="label">Invested</p><p className="num mt-1 text-2xl">{money(p.holdings.reduce((s, h) => s + h.amount, 0))}</p><p className="text-sm text-muted">{p.holdings.length} holdings</p></div>
          <div className="paper p-4">
            <p className="label">Bad year loss<Info term="Bad year loss" onAsk={onAsk} /></p>
            <p className="num mt-1 text-2xl">{money(p.badYearLoss)}</p>
            {loss && <p className="mt-1 text-sm">{p.badYearLoss <= Number(loss.value) ? <Pill tone="good">Within {loss.id}</Pill> : <Pill tone="bad">Above {loss.id}</Pill>}</p>}
          </div>
          <div className="paper p-4"><p className="label">Typical year<Info term="Typical range" onAsk={onAsk} /></p><p className="num mt-1 text-lg">{money(p.typicalRange[0])} to plus {money(p.typicalRange[1])}</p></div>
          <div className="paper p-4"><p className="label">Your rules</p><p className="num mt-1 text-2xl">{p.ruleSummary.length}</p><p className="text-sm text-muted">checked against this mix</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          <div className="paper p-5 shadow-paper xl:col-span-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl font-semibold">Asset allocation</h2>
              <p className="text-sm text-muted">{p.split.stocks}% shares, {p.split.bonds}% bonds{p.split.cash ? `, ${p.split.cash}% cash` : ""}<Info term="Split" onAsk={onAsk} /></p>
            </div>
            <div className="mt-4"><AllocationPie slices={slices} active={active} onPick={setActive} /></div>
          </div>
          <div className="grid content-start gap-4 xl:col-span-2">
            <div className="paper p-5">
              <h2 className="font-serif text-xl font-semibold">Shares, bonds and cash</h2>
              <div className="mt-3"><ClassDonut split={p.split} /></div>
            </div>
            <div className="paper p-5">
              <h2 className="font-serif text-xl font-semibold">By sector</h2>
              <div className="mt-3"><HBars rows={sectors} /></div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="paper p-5 shadow-paper">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl font-semibold">How the mix moved</h2>
              <div className="flex gap-1">{RANGES.map((r) => <button key={r} type="button" className={`chip px-2 py-0.5 text-xs ${range === r ? "chip-on" : ""}`} onClick={() => setRange(r)}>{r}</button>)}</div>
            </div>
            <p className="mt-1 text-sm text-muted">Weighted by what you hold, indexed to 100 at the start of this window.{covered ? ` ${covered} of ${p.holdings.length} holdings included.` : ""}</p>
            {move !== null && <p className={`num mt-2 text-lg ${move >= 0 ? "text-good" : "text-bad"}`}>{move >= 0 ? "Up" : "Down"} {Math.abs(move).toFixed(1)} from 100</p>}
            {trend === null && <p className="mt-8 animate-pulse text-sm text-muted">Loading price history…</p>}
            {trend && trend.length > 1 && <div className="mt-2"><TrendChart points={trend} /></div>}
            {trend && trend.length < 2 && <p className="mt-6 text-sm text-muted">Market history is unavailable right now. Allocation above still uses your portfolio.</p>}
          </div>
          <div className="paper p-5">
            <h2 className="font-serif text-2xl font-semibold">One year return</h2>
            <p className="mt-1 text-sm text-muted">Each holding on its own, before it was mixed into the portfolio.</p>
            <div className="mt-4">
              {returns === null && <p className="animate-pulse text-sm text-muted">Loading returns…</p>}
              {returns && returns.length > 0 && <HBars rows={returns.map((r) => ({ label: r.name, value: r.ret, display: `${r.ret >= 0 ? "+" : ""}${r.ret.toFixed(1)}%`, color: r.ret >= 0 ? "#2E7D5B" : "#B4473A" }))} />}
              {returns && returns.length === 0 && <p className="text-sm text-muted">Returns are unavailable right now.</p>}
            </div>
          </div>
        </div>
      </div>

      <div id="holdings" className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="paper p-5 shadow-paper">
        <h2 className="font-serif text-2xl font-semibold">Holdings and the reason</h2>
        <ul className="mt-2 divide-y divide-line">
          {p.holdings.map((h, i) => (
            <li key={h.ticker}>
              <button className="grid w-full grid-cols-[12px_1fr_auto] gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-sky" onClick={() => { setActive(h.ticker); onOpen(h.ticker); }}>
                <span className="mt-1.5 h-3 w-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="min-w-0">
                  <span className="font-semibold">{h.name}</span> <span className="num text-xs text-muted">{h.ticker} · {h.sector}</span> {dissent(h.ticker)}
                  <span className="mt-0.5 flex flex-wrap gap-x-4 text-sm"><span className="text-good">+ <Bold text={h.pros[0]?.text ?? ""} /></span><span className="text-bad">minus <Bold text={h.cons[0]?.text ?? ""} /></span></span>
                </span>
                <span className="text-right"><b className="num block">{money(h.amount)}</b><span className="num text-xs text-muted">{((h.amount / (p.holdings.reduce((s, x) => s + x.amount, 0) || 1)) * 100).toFixed(1)}%</span></span>
              </button>
            </li>
          ))}
        </ul>
        </div>
        <div className="grid content-start gap-4">
          <CommitteeCard c={committee} onOpen={onOpen} onRerun={onRerunCommittee} />
          <div className="paper p-5">
            <p className="label mb-2">Your rules</p>
            <ul className="grid gap-1.5 text-sm">
              {p.ruleSummary.map((s) => <li key={s.ruleId} className="flex gap-2"><span className="num rounded bg-baby px-1.5 text-accent">{s.ruleId}</span><span>{s.status}</span></li>)}
            </ul>
          </div>
          {trust?.learned?.notes?.length ? (
            <div className="paper p-5">
              <div className="flex justify-between"><p className="label">Learned from you</p><button className="text-xs font-semibold text-accent" onClick={onResetLearning}>Reset</button></div>
              <ul className="mt-2 grid gap-1 text-sm">{trust.learned.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
