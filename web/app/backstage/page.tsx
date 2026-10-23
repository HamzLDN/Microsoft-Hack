"use client";
// Backstage: what the AI did behind the scenes. Committee sessions with full transcripts, every chat, and the system checks.
import { useEffect, useState } from "react";
import { api, Bold, money } from "@/components/ui";

const TITLE: Record<string, string> = { fundamentals: "Fundamentals", markets: "Markets and news", fit: "Client fit" };
const COLOR: Record<string, string> = { fundamentals: "#2F7FC1", markets: "#7A86C8", fit: "#3E8E7E" };
const KIND: Record<string, string> = { agree: "agrees", challenge: "challenges", question: "asks", summary: "sums up" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Avatar({ a }: { a: string }) {
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-serif text-sm font-semibold text-white" style={{ background: COLOR[a] ?? "#5E6E7E" }}>{(TITLE[a] ?? a)[0]}</span>;
}

function Item({ it }: { it: any }) {
  const [open, setOpen] = useState(false);
  const changed = it.after && (it.after.status !== it.before.status || Math.abs(it.after.amount - it.before.amount) >= 300);
  return (
    <div className="border-t border-line py-3">
      <button className="flex w-full flex-wrap items-baseline gap-x-3 text-left" onClick={() => setOpen(!open)}>
        <b>{it.name}</b><span className="num text-xs text-muted">{it.ticker}</span>
        <span className="num text-xs">committee {it.adjustment > 0 ? "plus" : it.adjustment < 0 ? "minus" : ""} {Math.abs(it.adjustment)}</span>
        {it.after && <span className="num text-xs text-muted">{money(it.before.amount)} to {money(it.after.amount)}{it.after.status !== it.before.status ? ` · ${it.before.status} to ${it.after.status}` : ""}</span>}
        {changed && <span className="rounded-full bg-warnsoft px-2 text-xs font-semibold text-warn">outcome changed</span>}
        {it.debate.shifts?.length > 0 && <span className="rounded-full bg-baby px-2 text-xs font-semibold text-accent">{it.debate.shifts.length} changed mind</span>}
        <span className="ml-auto text-xs font-semibold text-accent">{open ? "Hide" : "Show transcript"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="label mb-2">Round 1 · individual views</p>
            {it.round1.map((o: any, i: number) => (
              <div key={o.agent} className="mb-3 flex gap-2">
                <Avatar a={o.agent} />
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-muted"><b className="text-ink">{TITLE[o.agent]}</b> · leans {o.stance} · {it.models?.[i] ?? ""}{o.fallback ? " · data only summary" : ""}</p>
                  <ul className="mt-1 grid gap-1">{o.points.map((p: any, k: number) => <li key={k}><span className={p.polarity === "pro" ? "text-good" : "text-bad"}>{p.polarity === "pro" ? "+ " : "minus "}</span><Bold text={p.text} /> <span className="num text-[10px] text-accent">{p.evidenceIds.join(" ")}</span></li>)}</ul>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="label mb-2">Round 2 · discussion</p>
            {it.debate.turns.map((t: any, i: number) => (
              <div key={i} className="mb-3 flex gap-2">
                <Avatar a={t.from} />
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-muted"><b className="text-ink">{TITLE[t.from]}</b> {KIND[t.kind]} {t.to === "committee" ? "the committee" : TITLE[t.to]} · {t.model}</p>
                  <p className="mt-1 rounded-xl rounded-tl-sm bg-sky p-2.5"><Bold text={t.text} /></p>
                </div>
              </div>
            ))}
            {it.debate.shifts?.map((x: any) => <p key={x.agent} className="text-sm text-warn"><b>{TITLE[x.agent]}</b> changed from {x.from} to {x.to}{x.reason ? `: ${x.reason}` : ""}</p>)}
            <p className="mt-2 text-xs text-muted">Final: {Object.entries(it.debate.finalStances).map(([a, s]) => `${TITLE[a]} ${s}`).join(" · ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Backstage() {
  const [d, setD] = useState<any>(null);
  const [llm, setLlm] = useState<any>(null);
  const [tab, setTab] = useState<"sessions" | "chats" | "checks">("sessions");
  const [hash, setHash] = useState("");
  const load = () => api("/api/backstage").then(setD).catch(() => null);
  useEffect(() => {
    load();
    api("/api/llm-health").then(setLlm).catch((e) => setLlm({ ok: false, reason: e.message }));
    setHash(window.location.hash.slice(1));
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  const s = d?.stats;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="label">Bettervest · backstage</p><h1 className="font-serif text-4xl font-semibold">What the AI did</h1>
          <p className="mt-1 text-muted">Every committee discussion, every chat, and the checks that keep the AI honest. For the team and judges, not clients.</p></div>
        <p className="text-sm">{llm ? (llm.ok ? <>Model <b className="num">{llm.model}</b> via {llm.provider}</> : <span className="text-bad">AI not connected: data rules in use</span>) : "Checking model…"}</p>
      </header>
      <nav className="mt-5 flex gap-2">
        {([["sessions", `Committee sessions (${d?.sessions?.length ?? 0})`], ["chats", `Chats (${d?.chats?.length ?? 0})`], ["checks", "System checks"]] as const).map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? "chip-on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      {tab === "sessions" && (
        <div className="mt-4 grid gap-4">
          {!d?.sessions?.length && <p className="text-muted">No committee sessions yet. Build a portfolio in the app and the committee review runs automatically.</p>}
          {d?.sessions?.map((x: any) => (
            <section key={x.id} id={x.id} className={`paper p-5 ${hash === x.id ? "ring-2 ring-accent" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl font-semibold">Session {x.id}</h2>
                <span className="text-sm text-muted">{when(x.at)} · {x.items.length} companies · {(x.durationMs / 1000).toFixed(0)}s · bad year loss {money(x.badYearLoss.before)} to {money(x.badYearLoss.after)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{x.client}</p>
              {x.changes.length > 0 && (
                <div className="mt-3 rounded-lg bg-warnsoft p-3 text-sm">
                  <p className="label !text-warn">Outcomes changed by the discussion</p>
                  {x.changes.map((c: any) => <p key={c.ticker} className="mt-1"><b>{c.kind} {c.name}</b> <span className="num">{money(c.before)} to {money(c.after)}</span>. {c.speaker}: <Bold text={c.reason} /></p>)}
                </div>
              )}
              <div className="mt-3">{x.items.map((it: any) => <Item key={it.ticker} it={it} />)}</div>
            </section>
          ))}
        </div>
      )}

      {tab === "chats" && (
        <div className="paper mt-4 divide-y divide-line">
          {!d?.chats?.length && <p className="p-5 text-muted">No chats yet.</p>}
          {d?.chats?.map((c: any, i: number) => (
            <div key={i} className="grid gap-2 p-4 text-sm">
              <p className="text-xs text-muted">{when(c.at)} · {c.mode === "help" ? "Help assistant" : `${TITLE[c.agent] ?? c.agent} analyst on ${c.ticker ?? "a company"}`} · {c.model ?? "data rules"}{c.retried ? " · retried after a number check" : ""}{c.blocked?.length ? ` · blocked ${c.blocked.join(", ")}` : ""}</p>
              <p className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-baby p-2.5">{c.question}</p>
              <p className="max-w-[85%] whitespace-pre-line rounded-xl rounded-tl-sm bg-sky p-2.5"><Bold text={c.reply} /></p>
            </div>
          ))}
        </div>
      )}

      {tab === "checks" && s && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["AI numbers checked against the data", s.numbersChecked, "Every number an analyst writes is matched to the evidence, within 1%."],
            ["Unsupported numbers blocked", s.unsupportedBlocked, "Mismatches sent back for a retry, or replaced by the data only summary."],
            ["Analyst reviews run", s.analystRuns, `${s.firstTryPass} passed first time, ${s.retried} retried, ${s.fallbacks} data only.`],
            ["Rules users corrected", d.correctionRate === null ? "none yet" : `${d.correctionRate}%`, "Lower means the app reads people's words better."],
            ["Corrections remembered", d.correctionsStored, "Reused as examples, or applied directly once confirmed twice."],
            ["Rule accuracy before and after learning", d.evals?.ruleAccuracy ? `${d.evals.ruleAccuracy.before}% to ${d.evals.ruleAccuracy.after}%` : "run npm run eval", d.evals ? `${d.evals.expectedRules} expected rules, ${d.evals.method}.` : ""],
          ] as [string, any, string][]).map(([l, v, n]) => (
            <div key={l} className="paper p-4"><b className="num block text-3xl font-medium">{v ?? 0}</b><p className="font-semibold">{l}</p><p className="mt-1 text-sm text-muted">{n}</p></div>
          ))}
        </div>
      )}
    </main>
  );
}
