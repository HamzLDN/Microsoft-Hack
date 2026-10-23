"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { AppRule, Candidate, Portfolio } from "@/lib/types";
import { api, Bold, Info, money, Pill, Screen, Title } from "./ui";

const COLORS = ["#2F7FC1", "#5AA2DB", "#86BCE6", "#3E8E7E", "#6FB3A3", "#7A86C8", "#A39BD8", "#C48BA6", "#D2A26B", "#8FA65A", "#5E9FB8", "#B7C9D8"];
const sendFeedback = (kind: string, before: unknown, after: unknown, context?: unknown) => api("/api/feedback", { kind, before, after, context }).catch(() => null);

export function UnderstoodScreen({ rules, setRules, onBack, onNext, onAsk }: { rules: AppRule[]; setRules: (r: AppRule[]) => void; onBack: () => void; onNext: () => void; onAsk: (q: string) => void }) {
  const [draft, setDraft] = useState("");
  const renumber = (r: AppRule[]) => r.map((x, i) => ({ ...x, id: `C${i + 1}` }));
  const toggle = (i: number) => {
    const before = rules[i];
    const after = { ...before, kind: before.kind === "hard" ? "soft" : "hard", kindReason: "You changed this yourself", learnedFrom: undefined } as AppRule;
    setRules(rules.map((r, j) => (j === i ? after : r)));
    sendFeedback("rule_kind_toggle", before, after);
  };
  const remove = (i: number) => { sendFeedback("rule_removed", rules[i], null); setRules(renumber(rules.filter((_, j) => j !== i))); };
  const add = () => {
    if (!draft.trim()) return;
    const r: AppRule = { id: "", text: draft.trim(), kind: "soft", field: "note", op: "==", value: draft.trim(), source: "text", kindReason: "Added by you. Noted, but we can't check this automatically", confidence: 1 };
    sendFeedback("rule_added", null, r);
    setRules(renumber([...rules, r]));
    setDraft("");
  };
  return (
    <Screen k="understood">
      <Title sub={<>Each line is a rule your portfolio must follow. Tap <strong>Hard rule</strong> or <strong>Preference</strong> to switch it, remove anything wrong, or add your own.</>}>Here&apos;s what we understood</Title>
      <div className="grid max-w-3xl gap-2.5">
        {rules.map((r, i) => (
          <motion.div key={r.id + r.text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="paper flex items-start gap-3 p-4">
            <span className="num mt-0.5 rounded-md bg-baby px-2 py-0.5 text-sm font-medium text-accent">{r.id}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.text}</p>
              <p className="mt-0.5 text-sm text-muted">{r.quote ? <>From your words: <em>&ldquo;{r.quote}&rdquo;</em></> : "From the form"}</p>
              <p className="text-sm text-muted">{r.kindReason}</p>
              {r.learnedFrom ? <span className="mt-1 inline-block"><Pill tone="blue">Learned from {r.learnedFrom} earlier corrections</Pill></span> : null}
            </div>
            <button onClick={() => toggle(i)} className={`rounded-full px-3 py-1 text-xs font-semibold ${r.kind === "hard" ? "bg-badsoft text-bad" : "bg-warnsoft text-warn"}`}>
              {r.kind === "hard" ? "Hard rule" : "Preference"}
            </button>
            <button aria-label={`Remove ${r.id}`} className="px-1 text-muted hover:text-bad" onClick={() => remove(i)}>✕</button>
          </motion.div>
        ))}
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a rule in your own words"
            className="flex-1 rounded-lg border border-line bg-card p-2.5" />
          <button className="btn-ghost" onClick={add}>Add</button>
        </div>
        <p className="text-sm text-muted">Hard rule<Info term="Hard rule" onAsk={onAsk} /> rules a company out. Preference<Info term="Preference" onAsk={onAsk} /> only changes its score.</p>
      </div>
      <div className="mt-6 flex gap-3"><button className="btn-ghost" onClick={onBack}>Back</button><button className="btn" onClick={onNext}>Build my portfolio</button></div>
    </Screen>
  );
}

function CountUp({ to }: { to: number }) {
  const v = useMotionValue(0);
  const r = useTransform(v, (x) => Math.round(x));
  const [n, setN] = useState(0);
  useEffect(() => { const c = animate(v, to, { duration: 1 }); const u = r.on("change", setN); return () => { c.stop(); u(); }; }, [to, v, r]);
  return <>{n}</>;
}

export function Funnel({ p }: { p: Portfolio }) {
  const total = p.considered.length;
  const pass = p.considered.filter((c) => !c.mainReason.startsWith("Fails")).length;
  const chosen = p.holdings.length;
  return (
    <div className="mb-5 grid grid-cols-3 gap-3">
      {[[total, "companies and funds checked"], [pass, "pass your hard rules"], [chosen, "in your portfolio"]].map(([n, l]) => (
        <div key={l as string} className="border-l-4 border-accent pl-3">
          <b className="num block text-3xl font-medium"><CountUp to={n as number} /></b><span className="text-sm text-muted">{l}</span>
        </div>
      ))}
    </div>
  );
}

type Trust = { correctionRate: number | null; correctionsStored: number; learned: { notes: string[] } | null;
  stats: { analystRuns: number; firstTryPass: number; retried: number; fallbacks: number; numbersChecked: number; unsupportedBlocked: number }; evals: any };

export function PortfolioScreen({ p, rules, onOpen, onConsidered, onChallenge, onEdit, onAsk, trust, onResetLearning }: {
  p: Portfolio; rules: AppRule[]; onOpen: (t: string) => void; onConsidered: () => void; onChallenge: () => void; onEdit: () => void; onAsk: (q: string) => void; trust: Trust | null; onResetLearning: () => void;
}) {
  const loss = rules.find((r) => r.field === "max_bad_year_loss");
  return (
    <Screen k="portfolio">
      <Funnel p={p} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="paper p-5 shadow-paper">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-3xl font-semibold">Recommended for you: $100,000</h2>
            <button className="text-sm font-semibold text-accent" onClick={onEdit}>Change preferences</button>
          </div>
          <div className="mt-3 flex h-3.5 overflow-hidden rounded-full">
            {p.holdings.map((h, i) => <motion.i key={h.ticker} initial={{ width: 0 }} animate={{ width: `${h.amount / 1000}%` }} transition={{ duration: 0.6, delay: i * 0.03 }} className="block h-full" style={{ background: COLORS[i % COLORS.length] }} title={h.name} />)}
          </div>
          <p className="mt-2 text-sm text-muted">{p.split.stocks}% shares, {p.split.bonds}% bonds{p.split.cash ? `, ${p.split.cash}% cash` : ""}<Info term="Split" onAsk={onAsk} /></p>
          <ul className="mt-3 divide-y divide-line">
            {p.holdings.map((h, i) => (
              <li key={h.ticker}>
                <button className="grid w-full grid-cols-[12px_1fr_auto] gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-sky" onClick={() => onOpen(h.ticker)}>
                  <span className="mt-1.5 h-3 w-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="min-w-0">
                    <span className="font-semibold">{h.name}</span> <span className="num text-xs text-muted">{h.ticker} · {h.sector}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-4 text-sm"><span className="text-good">+ <Bold text={h.pros[0]?.text ?? ""} /></span><span className="text-bad">minus <Bold text={h.cons[0]?.text ?? ""} /></span></span>
                  </span>
                  <span className="text-right"><b className="num block">{money(h.amount)}</b>{h.score.total ? <span className="num text-xs text-muted">score {Math.round(h.score.total)}</span> : null}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-4">
          <div className="paper p-5">
            <p className="label">Risk</p>
            <p className="mt-1"><span className="num text-2xl">{money(p.badYearLoss)}</span> <span className="text-muted">bad year loss<Info term="Bad year loss" onAsk={onAsk} /></span></p>
            {loss && <p className="text-sm">{p.badYearLoss <= Number(loss.value) ? <Pill tone="good">Within your {loss.id} limit of {money(Number(loss.value))}</Pill> : <Pill tone="bad">Above your {loss.id} limit</Pill>}</p>}
            <p className="mt-2 text-sm text-muted">Typical year: {money(p.typicalRange[0])} to plus {money(p.typicalRange[1])}<Info term="Typical range" onAsk={onAsk} /></p>
          </div>
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
          <div className="flex flex-wrap gap-2"><button className="btn" onClick={onConsidered}>See everything we considered</button><button className="btn-ghost" onClick={onChallenge}>Challenge it</button></div>
        </div>
      </div>
    </Screen>
  );
}

export function ConsideredScreen({ p, rules, onOpen, onBack, onChallenge }: { p: Portfolio; rules: AppRule[]; onOpen: (t: string) => void; onBack: () => void; onChallenge: () => void }) {
  const [hi, setHi] = useState<string | null>(null);
  return (
    <Screen k="considered">
      <Title sub="Tap a rule to highlight what it affected. Tap a company for the full analysis.">Everything we considered</Title>
      <div className="mb-3 flex flex-wrap gap-2">
        {rules.map((r) => <button key={r.id} className={`chip ${hi === r.id ? "chip-on" : ""}`} onClick={() => setHi(hi === r.id ? null : r.id)}><span className="num">{r.id}</span> · {r.text.length > 36 ? `${r.text.slice(0, 36)}…` : r.text}</button>)}
      </div>
      <div className="paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><th className="p-3">Company</th><th className="p-3">Status</th><th className="p-3">Main reason</th><th className="p-3">What would change it<Info term="What would get it in" /></th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody>
            {p.considered.map((c) => {
              const hit = !hi || c.checks.some((ch) => ch.ruleId === hi && (!ch.pass || rules.find((r) => r.id === hi)?.field === "favour_sector"));
              return (
                <tr key={c.ticker} onClick={() => onOpen(c.ticker)} className={`cursor-pointer border-b border-line transition hover:bg-sky ${hit ? "" : "opacity-30"}`}>
                  <td className="p-3"><b>{c.name}</b><div className="num text-xs text-muted">{c.ticker} · {c.sector}</div></td>
                  <td className="p-3">{c.status === "included" ? <Pill tone="good">Included</Pill> : <Pill tone="bad">Excluded</Pill>}</td>
                  <td className="p-3"><Bold text={c.mainReason} />{c.status === "included" && <div className="text-xs text-bad">minus <Bold text={c.cons[0]?.text ?? ""} /></div>}</td>
                  <td className="p-3 text-warn">{c.whatWouldGetItIn ?? ""}</td>
                  <td className="num p-3 text-right">{c.status === "included" ? money(c.amount) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex gap-3"><button className="btn-ghost" onClick={onBack}>Back to portfolio</button><button className="btn" onClick={onChallenge}>Challenge it</button></div>
    </Screen>
  );
}

export function ChallengeScreen({ p, onDecide, onOpen, onDone, learnedNote }: { p: Portfolio; onDecide: (c: Candidate, own: boolean) => void; onOpen: (t: string) => void; onDone: () => void; learnedNote: string }) {
  const [seen, setSeen] = useState<string[]>([]);
  const deck = useMemo(() => p.considered.filter((c) => !c.mainReason.startsWith("Fails") && !seen.includes(c.ticker)).sort((a, b) => Number(a.status === "included") - Number(b.status === "included")), [p, seen]);
  const top = deck[0];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const decide = (own: boolean) => {
    if (!top) return;
    setSeen((s) => [...s, top.ticker]);
    x.set(0);
    onDecide(top, own);
  };
  const m = (c: Candidate, part: string) => Math.round(c.score.parts.find((x) => x.name === part)?.value ?? 0);
  return (
    <Screen k="challenge">
      <Title sub="Swipe right to own it, left to drop it. Your portfolio rebalances and learns what you care about.">Challenge the AI</Title>
      <div className="relative mx-auto h-[400px] max-w-sm">
        {deck.slice(0, 3).reverse().map((c, i, arr) => {
          const isTop = i === arr.length - 1;
          return (
            <motion.div key={c.ticker} drag={isTop ? "x" : false} style={isTop ? { x, rotate } : { scale: 1 - (arr.length - 1 - i) * 0.04, y: (arr.length - 1 - i) * 10 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 120) decide(info.offset.x > 0); }}
              className="paper absolute inset-0 grid cursor-grab content-start gap-3 p-6 shadow-paper active:cursor-grabbing">
              <span>{c.status === "included" ? <Pill tone="good">Currently in · {money(c.amount)}</Pill> : <Pill tone="warn">Currently out</Pill>}</span>
              <h2 className="font-serif text-3xl font-semibold">{c.name}</h2>
              <span className="num text-sm text-muted">{c.ticker} · {c.sector} · score {Math.round(c.score.total)}</span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {["Growth", "Stability", "Income"].map((k) => <div key={k} className="rounded-lg bg-sky p-2"><b className="num block text-lg">{m(c, k)}</b>{k}</div>)}
              </div>
              <p className="text-sm text-good">+ <Bold text={c.pros[0]?.text ?? ""} /></p>
              <p className="text-sm text-bad">minus <Bold text={c.cons[0]?.text ?? ""} /></p>
            </motion.div>
          );
        })}
        {!top && <div className="paper grid h-full place-items-center p-6 text-center"><p>All reviewed.<br /><button className="btn mt-3" onClick={onDone}>See your updated portfolio</button></p></div>}
      </div>
      <div className="mt-5 flex justify-center gap-3">
        <button className="btn-ghost" onClick={() => decide(false)} disabled={!top}>✕ Drop</button>
        <button className="btn-ghost" onClick={() => top && onOpen(top.ticker)} disabled={!top}>Details</button>
        <button className="btn" onClick={() => decide(true)} disabled={!top}>✓ Own</button>
      </div>
      <p className="mt-3 min-h-6 text-center text-sm text-accent">{learnedNote}</p>
      <div className="mt-2 text-center"><button className="text-sm font-semibold text-accent" onClick={onDone}>See updated portfolio</button></div>
    </Screen>
  );
}
